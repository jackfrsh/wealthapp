from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from sqlmodel import SQLModel
from .database import engine
from .database import ensure_schema
from . import models  # noqa: F401

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .middleware import add_middleware

from .routers import (
    auth,
    accounts,
    dashboard,
    settings,
    goals,
    snapshots,
    fx,
    insights,
    projection,
    history,
    admin,
    events,
    billing,
)


# ────────────────────────────────────────────
# Lifespan (replaces deprecated on_event)
# ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_schema()
    yield

app = FastAPI(title="Wealth App", lifespan=lifespan)

# ────────────────────────────────────────────
# CORS
# ────────────────────────────────────────────
_default_origins = ",".join([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
])
_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers + rate limiting (must be added AFTER CORS)
add_middleware(app)

# ────────────────────────────────────────────
# Routers
# ────────────────────────────────────────────
API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(goals.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(snapshots.router, prefix=API_PREFIX)
app.include_router(fx.router, prefix=API_PREFIX)
app.include_router(insights.router, prefix=API_PREFIX)
app.include_router(projection.router, prefix=API_PREFIX)
app.include_router(history.router, prefix=API_PREFIX)
app.include_router(billing.router, prefix=API_PREFIX)
app.include_router(events.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)

# ────────────────────────────────────────────
# Health
# ────────────────────────────────────────────
# Bearer auth (no cookie sessions) makes CSRF tokens unnecessary.
# All state-changing requests require a valid Authorization header,
# which cannot be forged by cross-origin form submissions.

@app.get("/health")
def health():
    """Lightweight health check for Railway / load balancers."""
    try:
        from sqlmodel import Session, text
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        return {"ok": True, "db": True}
    except Exception:
        return {"ok": True, "db": False}


# ────────────────────────────────────────────
# Serve frontend static files (production)
# ────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _DIST_DIR.is_dir():
    assets_dir = _DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Never intercept API or health routes
        if full_path.startswith("api") or full_path.startswith("health"):
            raise HTTPException(status_code=404, detail="Not Found")

        file_path = _DIST_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))

        return FileResponse(str(_DIST_DIR / "index.html"))