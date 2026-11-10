# ==============================================================================
# DataWatch Backend — Production Dockerfile for Render / Cloud Containers
# ==============================================================================
# Python 3.11-slim is specifically selected to guarantee 100% stability with
# Great Expectations 0.18.22, Scikit-learn, and AsyncPG without Python 3.14 friction.

FROM python:3.11-slim

# Environment flags for container execution
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    GX_ANONYMOUS_USAGE_STATISTICS=false

WORKDIR /app

# Install essential system build dependencies for database drivers & scientific wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Layer-cached dependency installation
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the complete application codebase
COPY . /app

# Default port documentation
EXPOSE 8000

# Run database migrations on container startup, then start Uvicorn with a single worker
# (1 worker optimizes memory consumption within Render's 512 MB free tier)
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
