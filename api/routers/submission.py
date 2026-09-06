import os
import json
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from api.database import get_db
from api.models import Submission, Exam, Question
from api.schemas import SubmissionCreate, SubmissionOut
from api.security import get_current_user
from evaluation.mcq_evaluator import evaluate_mcq
from evaluation.fill_evaluator import evaluate_fill_blank
from evaluation.subjective_evaluator import evaluate_subjective

router = APIRouter(prefix="/submissions", tags=["Submissions"])


def evaluate_subjective_with_ai(question_text: str, student_answer: str, correct_answer: str, max_marks: float, strictness: str = "medium", collection_name: str = None) -> dict:
    """Evaluates subjective answer using structured AI rubric evaluation or semantic fallback."""
    return evaluate_subjective(
        question_text=question_text,
        student_answer=student_answer,
        correct_answer=correct_answer,
        max_marks=max_marks,
        strictness=strictness,
        collection_name=collection_name,
    )


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

    evaluations = {}
    total_score = 0.0
    strictness = exam.evaluation_strictness or "medium"

    for q in exam.questions:
        q_id_str = str(q.id)
        student_ans = data.answers.get(q_id_str)
        if student_ans is None:
            student_ans = data.answers.get(q.id)
        if student_ans is None:
            student_ans = data.answers.get(str(q.question_number))
        if student_ans is None:
            student_ans = ""
        student_ans = str(student_ans).strip()

        q_type = (q.question_type or "mcq").lower()
        max_marks = float(q.marks or 1.0)
        correct_ans = q.correct_answer or ""

        res_detail = {}
        if not student_ans:
            marks_awarded = 0.0
            feedback = f"No answer provided. Expected: {correct_ans}" if correct_ans else "No answer provided."
            res_detail = {
                "score": 0.0,
                "max_score": max_marks,
                "percentage": 0.0,
                "confidence": 1.0,
                "overall_assessment": "No answer provided",
                "criteria": [{
                    "criterion": "Response submission",
                    "status": "missing",
                    "score": 0.0,
                    "max_score": max_marks,
                    "feedback": "No answer was provided by the student.",
                }],
                "strengths": [],
                "missing_points": ["Complete answer was not submitted."],
                "improvement_suggestion": "Please provide an answer explaining the required concepts.",
                "evaluation_method": "empty_guard",
            }
        elif q_type == "mcq":
            res = evaluate_mcq(student_ans, correct_ans, max_marks)
            marks_awarded = float(res.get("marks_awarded", 0.0))
            feedback = res.get("feedback", "")
            is_full = marks_awarded >= max_marks
            res_detail = {
                "score": marks_awarded,
                "max_score": max_marks,
                "percentage": round((marks_awarded / max_marks) * 100, 1) if max_marks > 0 else 0.0,
                "confidence": 1.0,
                "overall_assessment": "Correct option selected" if is_full else "Incorrect option selected",
                "criteria": [{
                    "criterion": "Correct option selection",
                    "status": "satisfied" if is_full else "incorrect",
                    "score": marks_awarded,
                    "max_score": max_marks,
                    "feedback": feedback,
                }],
                "strengths": ["Selected the correct answer choice."] if is_full else [],
                "missing_points": [f"Correct option: {correct_ans}"] if not is_full else [],
                "improvement_suggestion": "Review the relevant topic material." if not is_full else "",
                "evaluation_method": "rule_based",
            }
        elif q_type in ("fill_blank", "fill_blanks", "fill"):
            res = evaluate_fill_blank(student_ans, correct_ans, max_marks, strictness)
            marks_awarded = float(res.get("marks_awarded", 0.0))
            feedback = res.get("feedback", "")
            is_full = marks_awarded >= max_marks
            res_detail = {
                "score": marks_awarded,
                "max_score": max_marks,
                "percentage": round((marks_awarded / max_marks) * 100, 1) if max_marks > 0 else 0.0,
                "confidence": float(res.get("confidence", 0.9)),
                "overall_assessment": "Exact or fuzzy match" if is_full else ("Partially correct" if marks_awarded > 0 else "Incorrect term"),
                "criteria": [{
                    "criterion": "Accurate term or concept match",
                    "status": "satisfied" if is_full else ("partially_satisfied" if marks_awarded > 0 else "incorrect"),
                    "score": marks_awarded,
                    "max_score": max_marks,
                    "feedback": feedback,
                }],
                "strengths": ["Correct term provided."] if is_full else [],
                "missing_points": [f"Expected term: {correct_ans}"] if not is_full else [],
                "improvement_suggestion": "Review terminology in the textbook." if not is_full else "",
                "evaluation_method": "fuzzy_matching",
            }
        elif q_type in ("subjective", "long"):
            res = evaluate_subjective(
                question_text=q.question_text,
                student_answer=student_ans,
                correct_answer=correct_ans,
                max_marks=max_marks,
                strictness=strictness,
                collection_name=exam.collection_name,
            )
            marks_awarded = float(res.get("score", res.get("marks_awarded", 0.0)))
            feedback = res.get("feedback", "")
            res_detail = res
        else:
            marks_awarded = 0.0
            feedback = "Evaluation complete."
            res_detail = {"score": 0.0, "max_score": max_marks, "overall_assessment": "Unknown question type"}

        total_score += marks_awarded
        evaluations[q_id_str] = {
            "question_id": q.id,
            "question_number": q.question_number,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "student_answer": student_ans,
            "correct_answer": correct_ans,
            "marks_awarded": marks_awarded,
            "max_marks": max_marks,
            "feedback": feedback,
            # Structured Rubric Details
            "score": res_detail.get("score", marks_awarded),
            "percentage": res_detail.get("percentage", round((marks_awarded / max_marks) * 100, 1) if max_marks > 0 else 0.0),
            "confidence": res_detail.get("confidence", 0.9),
            "overall_assessment": res_detail.get("overall_assessment", "Evaluated"),
            "criteria": res_detail.get("criteria", []),
            "strengths": res_detail.get("strengths", []),
            "missing_points": res_detail.get("missing_points", []),
            "improvement_suggestion": res_detail.get("improvement_suggestion", ""),
            "evaluation_method": res_detail.get("evaluation_method", "ai_rubric"),
            "semantic_similarity": res_detail.get("semantic_similarity", None),
        }

    submission = Submission(
        exam_id=data.exam_id,
        student_id=current_user["id"],
        answers=data.answers,
        total_score=round(total_score, 1),
        status="evaluated",
        evaluations=evaluations,
        submitted_at=datetime.utcnow(),
        evaluated_at=datetime.utcnow(),
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
    return db.query(Submission).filter(Submission.student_id == current_user["id"]).order_by(Submission.id.desc()).all()


@router.get("", response_model=List[SubmissionOut])
@router.get("/", response_model=List[SubmissionOut])
def list_submissions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] == "teacher":
        return db.query(Submission).order_by(Submission.id.desc()).all()
    return db.query(Submission).filter(Submission.student_id == current_user["id"]).order_by(Submission.id.desc()).all()


@router.get("/exam/{exam_id}", response_model=List[SubmissionOut])
def get_exam_submissions(
    exam_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Submission).filter(Submission.exam_id == exam_id).order_by(Submission.id.desc()).all()


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_single_submission(
    submission_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if current_user["role"] != "teacher" and sub.student_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return sub