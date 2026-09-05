from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from api.database import get_db
from api.models import Teacher, Student
from api.schemas import TeacherRegister, StudentRegister, LoginRequest, TokenResponse
from api.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/teacher", status_code=status.HTTP_201_CREATED)
def register_teacher(data: TeacherRegister, db: Session = Depends(get_db)):
    if db.query(Teacher).filter(Teacher.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    teacher = Teacher(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        subject=data.subject,
    )
    db.add(teacher)
    db.commit()
    return {"message": "Teacher registered successfully"}


@router.post("/register/student", status_code=status.HTTP_201_CREATED)
def register_student(data: StudentRegister, db: Session = Depends(get_db)):
    if db.query(Student).filter(Student.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    student = Student(
        name=data.name,
        email=data.email,
        roll_number=data.roll_number,
        password_hash=hash_password(data.password),
    )
    db.add(student)
    db.commit()
    return {"message": "Student registered successfully"}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = None
    if data.role == "teacher":
        user = db.query(Teacher).filter(Teacher.email == data.email).first()
    elif data.role == "student":
        user = db.query(Student).filter(Student.email == data.email).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": data.role, "email": user.email})
    return TokenResponse(access_token=token, role=data.role, user_id=user.id, name=user.name)


@router.get("/me")
def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] == "teacher":
        teacher = db.query(Teacher).filter(Teacher.id == current_user["id"]).first()
        if teacher:
            return {"id": teacher.id, "name": teacher.name, "email": teacher.email, "role": "teacher", "subject": teacher.subject}
    elif current_user["role"] == "student":
        student = db.query(Student).filter(Student.id == current_user["id"]).first()
        if student:
            return {"id": student.id, "name": student.name, "email": student.email, "role": "student", "roll_number": student.roll_number}
    return current_user