# =============================================================================
# Multi-stage Dockerfile for Student-Teacher Evaluation System
# Optimized for AWS EC2 t2.micro (1GB RAM) with CPU-only torch
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder — install all Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /install

COPY requirements-deploy.txt .

RUN pip install --no-cache-dir --prefix=/install/deps \
    -r requirements-deploy.txt

# ---------------------------------------------------------------------------
# Stage 2: Runtime — lean image with only what we need
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

# Install minimal runtime libs (sqlite3 is included in python:3.11-slim)
# poppler-utils is needed by pdf2image for PDF-to-image conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install/deps /usr/local

WORKDIR /app

# Copy application source
COPY app.py .
COPY auth/ ./auth/
COPY config/ ./config/
COPY database/ ./database/
COPY pdf_processing/ ./pdf_processing/
COPY rag/ ./rag/
COPY generation/ ./generation/
COPY evaluation/ ./evaluation/
COPY utils/ ./utils/
COPY pages/ ./pages/
COPY .streamlit/ ./.streamlit/

# Pre-download the sentence-transformer model so first request is fast
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# Create directories for persistent data and set ownership
RUN mkdir -p /app/database /app/chroma_db && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8501/_stcore/health || exit 1

ENTRYPOINT ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
