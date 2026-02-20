# ---------- build frontend ----------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- build backend ----------
FROM python:3.12-slim AS backend
WORKDIR /app

# System deps (usually safe; remove if you want leaner)
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy built frontend dist into expected location: /app/frontend/dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Run
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-lc", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]