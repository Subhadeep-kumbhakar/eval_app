from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Submission, Exam
from api.schemas import SubmissionCreate, SubmissionOut
from api.security import get_current_user

router = APIRouter(prefix="/submissions", tags=["Submissions"])


@router.post("/", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_answers(
    data: SubmissionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit exams")

    exam = db.query(Exam).filter(Exam.id == data.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submission = Submission(
        exam_id=data.exam_id,
        student_id=current_user["id"],
        answers=data.answers,
        status="submitted",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/student", response_model=List[SubmissionOut])
def get_student_submissions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Unauthorized")
    return db.query(Submission).filter(Submission.student_id == current_user["id"]).all()