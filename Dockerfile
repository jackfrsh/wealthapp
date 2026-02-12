# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build the Vite/React frontend
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-slim AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2: Python backend + built frontend
# ═══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim

# System deps for psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy Alembic config + migrations
COPY alembic.ini .
COPY alembic/ ./alembic/

# Copy built frontend from stage 1
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Railway injects PORT; default to 8000
ENV PORT=8000

# Start script: run migrations then start uvicorn
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
