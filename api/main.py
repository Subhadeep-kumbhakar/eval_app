from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.database import engine, Base
from api.routers import auth, exams, submission, tasks

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Student-Teacher Evaluation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(exams.router)
app.include_router(submission.router)
app.include_router(tasks.router)



@app.get("/")
def root():
    return {"status": "running", "message": "eval_app API is active"}