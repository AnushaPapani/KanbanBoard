# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app/backend
COPY backend/pyproject.toml ./
RUN uv sync

COPY backend/app ./app
COPY --from=frontend-builder /app/frontend/out /app/frontend/out

ENV PATH="/app/backend/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
