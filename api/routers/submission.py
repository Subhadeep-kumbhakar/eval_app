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
from rapidfuzz import fuzz
from google import genai
from google.genai import types

router = APIRouter(prefix="/submissions", tags=["Submissions"])


def evaluate_subjective_with_ai(question_text: str, student_answer: str, correct_answer: str, max_marks: float, strictness: str = "medium") -> dict:
    """Evaluates subjective answer using Gemini 3.6 Flash or resilient semantic matching."""
    if not student_answer or not str(student_answer).strip():
        return {"marks_awarded": 0.0, "feedback": "No answer provided.", "confidence": 1.0}

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            You are a university examiner evaluating a student's answer against a model answer key.
            
            Question: {question_text}
            Model Answer: {correct_answer}
            Student Answer: {student_answer}
            Max Marks: {max_marks}
            Evaluation Strictness: {strictness}
            
            Evaluate the answer based on concept coverage, accuracy, and clarity.
            Return ONLY a valid JSON object matching:
            {{
              "marks_awarded": <number between 0.0 and {max_marks}>,
              "feedback": "<1-2 constructive sentences on strengths/weaknesses>",
              "confidence": <number between 0.0 and 1.0>
            }}
            """
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1),
            )
            data = json.loads(response.text.strip())
            marks = float(data.get("marks_awarded", 0.0))
            marks = max(0.0, min(marks, max_marks))
            return {
                "marks_awarded": round(marks, 1),
                "feedback": data.get("feedback", "AI semantic evaluation completed."),
                "confidence": float(data.get("confidence", 0.9)),
            }
        except Exception as e:
            print(f"AI evaluation fallback to semantic matching: {e}")

    # Fallback to fuzzy token match
    ratio = fuzz.token_set_ratio(str(student_answer).lower(), str(correct_answer).lower())
    scaled_marks = round((ratio / 100.0) * max_marks, 1)
    feedback = f"Evaluated based on conceptual alignment ({ratio}% match with answer key)."
    return {
        "marks_awarded": min(scaled_marks, max_marks),
        "feedback": feedback,
        "confidence": round(ratio / 100.0, 2),
    }


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

        if not student_ans:
            marks_awarded = 0.0
            feedback = f"No answer provided. Expected: {correct_ans}" if correct_ans else "No answer provided."
        elif q_type == "mcq":
            res = evaluate_mcq(student_ans, correct_ans, max_marks)
            marks_awarded = float(res.get("marks_awarded", 0.0))
            feedback = res.get("feedback", "")
        elif q_type in ("fill_blank", "fill_blanks", "fill"):
            res = evaluate_fill_blank(student_ans, correct_ans, max_marks, strictness)
            marks_awarded = float(res.get("marks_awarded", 0.0))
            feedback = res.get("feedback", "")
        elif q_type in ("subjective", "long"):
            res = evaluate_subjective_with_ai(q.question_text, student_ans, correct_ans, max_marks, strictness)
            marks_awarded = float(res.get("marks_awarded", 0.0))
            feedback = res.get("feedback", "")
        else:
            marks_awarded = 0.0
            feedback = "Evaluation complete."

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