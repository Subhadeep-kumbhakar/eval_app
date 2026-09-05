import os
import shutil
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from api.database import get_db
from api.models import Exam, Question, TaskJob
from api.schemas import ExamOut, TaskCreateResponse
from api.security import get_current_user
from pdf_processing.extractor import extract_text_from_pdf
from generation.gemini_generator import generate_exam_from_text
from storage.local import default_storage
from tasks.pdf_tasks import extract_pdf_task
from tasks.embedding_tasks import process_pdf_and_embed_pipeline_task

router = APIRouter(prefix="/exams", tags=["Exams"])


def clean_exam_options(exam: Exam):
    """Ensures options is always a valid Python list so JSON serialization never fails."""
    if hasattr(exam, "questions") and exam.questions:
        for q in exam.questions:
            if isinstance(q.options, str):
                try:
                    q.options = json.loads(q.options)
                except Exception:
                    q.options = []
            elif q.options is None:
                q.options = []
    return exam


@router.post("/process-pdf", response_model=TaskCreateResponse, status_code=status.HTTP_202_ACCEPTED)
@router.post("/upload-pdf", response_model=TaskCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_and_process_pdf_async(
    pdf_file: UploadFile = File(...),
    collection_name: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asynchronous PDF processing and vector store embedding endpoint.
    Saves PDF to persistent storage, creates a TaskJob, and dispatches Celery pipeline.
    Returns task_id immediately without blocking the HTTP request lifecycle.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can upload and process exam materials")

    filename = pdf_file.filename or "uploaded_document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported")

    # Read and persist file via storage abstraction
    file_bytes = await pdf_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    stored_file_path = default_storage.save_file(file_bytes, filename)

    if not collection_name or not collection_name.strip():
        collection_name = f"exam_{uuid.uuid4().hex[:12]}"

    # Create tracked task record in database
    job = TaskJob(
        task_type="full_pdf_pipeline",
        status="QUEUED",
        progress=0,
        message="PDF processing and embedding task queued",
        result_metadata={"original_filename": filename, "collection_name": collection_name},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch to Celery worker
    try:
        async_task = process_pdf_and_embed_pipeline_task.delay(
            task_job_id=job.id,
            file_path=stored_file_path,
            collection_name=collection_name,
            source_name=filename,
        )
        job.celery_task_id = async_task.id
        db.commit()
    except Exception as e:
        job.status = "FAILED"
        job.error = "Failed to dispatch task to message broker. Ensure Redis is running."
        db.commit()
        raise HTTPException(status_code=503, detail="Message broker unavailable. Task could not be queued.")

    return TaskCreateResponse(
        task_id=job.id,
        celery_task_id=job.celery_task_id,
        status="QUEUED",
        message="PDF background processing started. Poll /tasks/{task_id} for progress.",
    )


@router.post("/extract-pdf", response_model=TaskCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def extract_pdf_async(
    pdf_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asynchronous PDF text extraction task endpoint."""
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can extract exam documents")

    filename = pdf_file.filename or "uploaded_document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported")

    file_bytes = await pdf_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    stored_file_path = default_storage.save_file(file_bytes, filename)

    job = TaskJob(
        task_type="pdf_processing",
        status="QUEUED",
        progress=0,
        message="PDF extraction task queued",
        result_metadata={"original_filename": filename},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        async_task = extract_pdf_task.delay(
            task_job_id=job.id,
            file_path=stored_file_path,
        )
        job.celery_task_id = async_task.id
        db.commit()
    except Exception:
        job.status = "FAILED"
        job.error = "Failed to dispatch task to message broker. Ensure Redis is running."
        db.commit()
        raise HTTPException(status_code=503, detail="Message broker unavailable. Task could not be queued.")

    return TaskCreateResponse(
        task_id=job.id,
        celery_task_id=job.celery_task_id,
        status="QUEUED",
        message="PDF extraction queued. Poll /tasks/{task_id} for progress.",
    )


@router.post("/generate-ai", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def generate_ai_exam(
    title: str = Form("AI Generated Exam"),
    total_marks: float = Form(50.0),
    num_mcq: int = Form(3),
    num_fill_blanks: int = Form(2),
    num_subjective: int = Form(2),
    strictness: str = Form("medium"),
    pdf_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can generate exams")

    file_bytes = await pdf_file.read()
    temp_pdf_path = default_storage.save_file(file_bytes, pdf_file.filename or "temp.pdf")


    try:
        extracted_text = extract_text_from_pdf(temp_pdf_path)
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        questions_data = generate_exam_from_text(
            context_text=extracted_text,
            title=title,
            num_mcq=num_mcq,
            num_fill=num_fill_blanks,
            num_sub=num_subjective,
            strictness=strictness,
        )

        if not questions_data:
            raise HTTPException(status_code=500, detail="Gemini failed to generate questions")

        exam = Exam(
            teacher_id=current_user["id"],
            title=title,
            total_marks=total_marks,
            num_mcq=num_mcq,
            num_fill_blanks=num_fill_blanks,
            num_subjective=num_subjective,
            evaluation_strictness=strictness,
            collection_name=pdf_file.filename,
        )
        db.add(exam)
        db.flush()

        for idx, q in enumerate(questions_data):
            opts = q.get("options", [])
            if isinstance(opts, str):
                try:
                    opts = json.loads(opts)
                except Exception:
                    opts = []

            question = Question(
                exam_id=exam.id,
                question_type=q.get("question_type", "mcq"),
                question_text=q.get("question_text", ""),
                options=opts,
                correct_answer=q.get("correct_answer", ""),
                marks=float(q.get("marks", 2.0)),
                topic=q.get("topic", "General"),
                difficulty=strictness,
                question_number=idx + 1,
            )
            db.add(question)

        db.commit()
        db.refresh(exam)
        return clean_exam_options(exam)

    finally:
        default_storage.delete_file(temp_pdf_path)



@router.get("", response_model=List[ExamOut])
@router.get("/", response_model=List[ExamOut])
def list_exams(db: Session = Depends(get_db)):
    exams = db.query(Exam).order_by(Exam.id.desc()).all()
    for exam in exams:
        clean_exam_options(exam)
    return exams


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return clean_exam_options(exam)


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete exams")
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    db.delete(exam)
    db.commit()
    return {"message": "Exam deleted successfully"}