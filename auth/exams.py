from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Exam, Question
from api.schemas import ExamCreate, ExamOut
from api.security import get_current_user

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.post("/", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(
    data: ExamCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create exams")

    exam = Exam(
        teacher_id=current_user["id"],
        title=data.title,
        total_marks=data.total_marks,
        num_mcq=data.num_mcq,
        num_fill_blanks=data.num_fill_blanks,
        num_subjective=data.num_subjective,
        marks_per_mcq=data.marks_per_mcq,
        marks_per_fill=data.marks_per_fill,
        marks_per_subjective=data.marks_per_subjective,
        topic_weightage=data.topic_weightage,
        evaluation_strictness=data.evaluation_strictness,
        collection_name=data.collection_name,
    )
    db.add(exam)
    db.flush()

    for q in data.questions:
        question = Question(
            exam_id=exam.id,
            question_type=q.question_type,
            question_text=q.question_text,
            options=q.options,
            correct_answer=q.correct_answer,
            marks=q.marks,
            topic=q.topic,
            difficulty=q.difficulty,
            question_number=q.question_number,
        )
        db.add(question)

    db.commit()
    db.refresh(exam)
    return exam


@router.get("/", response_model=List[ExamOut])
def list_exams(db: Session = Depends(get_db)):
    return db.query(Exam).all()


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam