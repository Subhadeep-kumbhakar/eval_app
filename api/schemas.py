from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# Auth Schemas
class TeacherRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    subject: str = ""


class StudentRegister(BaseModel):
    name: str
    email: EmailStr
    roll_number: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str  # "teacher" or "student"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


# Exam Schemas
class QuestionCreate(BaseModel):
    question_type: str
    question_text: str
    options: List[str] = []
    correct_answer: str = ""
    marks: float
    topic: str = ""
    difficulty: str = "medium"
    question_number: int


class ExamCreate(BaseModel):
    title: str
    total_marks: float
    num_mcq: int
    num_fill_blanks: int
    num_subjective: int
    marks_per_mcq: float = 1.0
    marks_per_fill: float = 2.0
    marks_per_subjective: float = 5.0
    topic_weightage: Dict[str, float] = {}
    evaluation_strictness: str = "medium"
    collection_name: str = ""
    questions: List[QuestionCreate] = []


class QuestionOut(BaseModel):
    id: int
    question_type: str
    question_text: str
    options: List[str]
    marks: float
    question_number: int

    class Config:
        from_attributes = True


class ExamOut(BaseModel):
    id: int
    title: str
    total_marks: float
    created_at: datetime
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True


# Submission Schemas
class SubmissionCreate(BaseModel):
    exam_id: int
    answers: Dict[str, Any]  # {"1": "B", "2": "Operating System"}


class SubmissionOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    total_score: float
    status: str
    evaluations: Dict[str, Any]
    submitted_at: datetime

    class Config:
        from_attributes = True