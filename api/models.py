from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from api.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    subject = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    exams = relationship("Exam", back_populates="teacher", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    roll_number = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    submissions = relationship("Submission", back_populates="student")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    title = Column(String(255), nullable=False)
    total_marks = Column(Float, default=0.0)
    num_mcq = Column(Integer, default=0)
    num_fill_blanks = Column(Integer, default=0)
    num_subjective = Column(Integer, default=0)
    marks_per_mcq = Column(Float, default=1.0)
    marks_per_fill = Column(Float, default=2.0)
    marks_per_subjective = Column(Float, default=5.0)
    topic_weightage = Column(JSON, default=dict)
    evaluation_strictness = Column(String(50), default="medium")  # easy, medium, hard
    collection_name = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("Teacher", back_populates="exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="exam")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_type = Column(String(50), nullable=False)  # 'mcq', 'fill_blanks', 'subjective'
    question_text = Column(Text, nullable=False)
    options = Column(JSON, default=list)  # ["A", "B", "C", "D"]
    correct_answer = Column(Text, default="")
    marks = Column(Float, default=0.0)
    topic = Column(String(255), default="")
    difficulty = Column(String(50), default="medium")
    question_number = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="questions")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    total_score = Column(Float, default=0.0)
    status = Column(String(50), default="submitted")  # submitted, evaluated
    answers = Column(JSON, default=dict)  # {question_id: student_answer}
    evaluations = Column(JSON, default=dict)  # {question_id: {score: x, feedback: y}}
    submitted_at = Column(DateTime, default=datetime.utcnow)
    evaluated_at = Column(DateTime, nullable=True)

    exam = relationship("Exam", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")


class TaskJob(Base):
    __tablename__ = "task_jobs"

    id = Column(Integer, primary_key=True, index=True)
    celery_task_id = Column(String(255), unique=True, index=True, nullable=True)
    task_type = Column(String(100), nullable=False)  # 'pdf_processing', 'embedding_generation', 'full_pdf_pipeline'
    status = Column(String(50), default="QUEUED", index=True)  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress = Column(Integer, default=0)  # 0 to 100
    message = Column(String(255), default="Task queued")
    error = Column(Text, nullable=True)
    result_metadata = Column(JSON, default=dict)  # stores collection_name, chunk_count, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)