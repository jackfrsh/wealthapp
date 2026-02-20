from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env first, before importing auth/router modules
BASE_DIR = Path(__file__).resolve().parents[1]  # backend/
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware

import os

from .database import create_db_and_tables
from .routers import auth, accounts, dashboard, settings, goals, snapshots, fx, insights, projection, history

app = FastAPI(title="Wealth App")

# CORS: local dev + production (configurable via ALLOWED_ORIGINS env var)
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
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

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

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

@app.get("/health")
def health():
    return {"ok": True}


# ─── Serve frontend static files (production) ──────────────────────────────

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException
from pathlib import Path

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

        # Try exact file first
        file_path = _DIST_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))

        # Otherwise serve SPA entrypoint
        return FileResponse(str(_DIST_DIR / "index.html"))