# Multi-stage Dockerfile for MacPulse (Coordinator API + Embedded React Dashboard)

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Coordinator Runtime
FROM python:3.11-slim AS runner
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, scripts, and runtime files
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY run.sh ./run.sh
COPY README.md ./README.md
COPY LICENSE ./LICENSE

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Setup persistent directory for SQLite database
RUN mkdir -p /app/data
ENV MACAI_DB_PATH=/app/data/macai_observatory.db
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
