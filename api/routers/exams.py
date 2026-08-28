import os
import shutil
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Exam, Question
from api.schemas import ExamOut
from api.security import get_current_user
from pdf_processing.extractor import extract_text_from_pdf
from generation.gemini_generator import generate_exam_from_text

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

    temp_pdf_path = f"temp_{pdf_file.filename}"
    with open(temp_pdf_path, "wb") as buffer:
        shutil.copyfileobj(pdf_file.file, buffer)

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
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)


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