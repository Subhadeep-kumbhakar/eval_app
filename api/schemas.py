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


# Rubric & Evaluation Schemas
class RubricCriterion(BaseModel):
    criterion: str
    status: str  # "satisfied", "partially_satisfied", "missing", "incorrect"
    score: float = 0.0
    max_score: float = 1.0
    feedback: str = ""


class SubjectiveEvaluationDetail(BaseModel):
    score: float
    max_score: float
    percentage: float
    confidence: float = 0.9
    overall_assessment: str  # e.g., "Fully correct", "Mostly correct", "Partially correct", "Needs improvement"
    criteria: List[RubricCriterion] = []
    strengths: List[str] = []
    missing_points: List[str] = []
    improvement_suggestion: str = ""
    evaluation_method: str = "ai_rubric"  # "ai_rubric" or "semantic_fallback"
    semantic_similarity: Optional[float] = None


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


# ============================================================
# Classroom & Enrollment Schemas
# ============================================================

class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class StudentOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    roll_number: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClassOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    teacher_id: int
    created_at: Optional[datetime] = None
    student_count: Optional[int] = 0
    exam_count: Optional[int] = 0

    class Config:
        from_attributes = True


class EnrollmentOut(BaseModel):
    id: int
    class_id: int
    student_id: int
    created_at: Optional[datetime] = None
    student: Optional[StudentOut] = None

    class Config:
        from_attributes = True


class ExamAssignmentCreate(BaseModel):
    due_date: Optional[datetime] = None
    is_active: Optional[bool] = True


class ExamAssignmentOut(BaseModel):
    id: int
    exam_id: int
    class_id: int
    assigned_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    is_active: bool = True
    class_name: Optional[str] = None
    exam_title: Optional[str] = None

    class Config:
        from_attributes = True


class ClassWithStudents(ClassOut):
    students: List[StudentOut] = []


class ClassWithExams(ClassOut):
    exams: List[ExamOut] = []