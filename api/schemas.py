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
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: Optional[str] = ""


# Safe Question & Exam Schemas
class QuestionOut(BaseModel):
    id: Optional[int] = None
    exam_id: Optional[int] = None
    question_type: Optional[str] = "mcq"
    question_text: Optional[str] = ""
    options: Optional[List[Any]] = []
    correct_answer: Optional[str] = ""
    marks: Optional[float] = 0.0
    topic: Optional[str] = ""
    difficulty: Optional[str] = "medium"
    question_number: Optional[int] = 1

    class Config:
        from_attributes = True


class ExamOut(BaseModel):
    id: int
    teacher_id: Optional[int] = None
    title: str
    total_marks: Optional[float] = 0.0
    num_mcq: Optional[int] = 0
    num_fill_blanks: Optional[int] = 0
    num_subjective: Optional[int] = 0
    evaluation_strictness: Optional[str] = "medium"
    created_at: Optional[datetime] = None
    questions: Optional[List[QuestionOut]] = []

    class Config:
        from_attributes = True


# Submission Schemas
class SubmissionCreate(BaseModel):
    exam_id: int
    answers: Dict[str, Any]


class StudentInfo(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    roll_number: Optional[str] = None

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    total_score: Optional[float] = 0.0
    status: Optional[str] = "submitted"
    answers: Optional[Dict[str, Any]] = {}
    evaluations: Optional[Dict[str, Any]] = {}
    submitted_at: Optional[datetime] = None
    student: Optional[StudentInfo] = None

    class Config:
        from_attributes = True


# Task Tracking Schemas
class TaskCreateResponse(BaseModel):
    task_id: int
    celery_task_id: Optional[str] = None
    status: str = "QUEUED"
    message: str = "Task queued"


class TaskStatusResponse(BaseModel):
    task_id: int
    celery_task_id: Optional[str] = None
    task_type: str
    status: str
    progress: int
    message: str
    error: Optional[str] = None
    result_metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True