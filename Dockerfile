# ---------- build frontend ----------
FROM node:20-alpine AS frontend-build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE=$VITE_API_BASE

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- build backend ----------
FROM python:3.12-slim AS backend
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps (requirements.txt at repo root)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy built frontend dist into expected location: /app/frontend/dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-lc", "cd /app/backend && python -m alembic upgrade head && cd /app && uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]