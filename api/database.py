import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from contextlib import contextmanager

# Guarantees it ALWAYS finds eval_app_v2.db in root regardless of where uvicorn is started
DB_PATH = Path(__file__).resolve().parent.parent / "eval_app_v2.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_task_db_session():
    """Independent database session context manager for Celery tasks.
    Ensures safe commit/rollback and that the session is always closed.
    Never reuses FastAPI request-scoped sessions.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()