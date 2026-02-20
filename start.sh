#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Use python3 explicitly (works locally + Railway Docker)
PYTHON_BIN=$(command -v python3 || command -v python)

$PYTHON_BIN -m alembic upgrade head

cd backend
exec $PYTHON_BIN -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
