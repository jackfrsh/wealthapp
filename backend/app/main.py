"""
Wealth App — FastAPI entrypoint.

All API routes are mounted under /api/*.
The built Vite frontend is served as static files with SPA fallback.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .database import create_db_and_tables
from .routers import auth, accounts, settings, snapshots, dashboard, history, projection, fx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wealth")

# ── Lifespan (replaces deprecated on_event) ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    logger.info("Wealth App started")
    yield
    logger.info("Wealth App shutting down")


app = FastAPI(
    title="Wealth App API",
    description="Personal wealth tracker",
    version="0.3.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handler — keep API errors user-safe ──────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if request.url.path.startswith("/api"):
        logger.exception("Unhandled API error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
    raise exc

# ── API Routers (all prefixed under /api) ─────────────────────────────────────
app.include_router(auth.router,       prefix="/api")
app.include_router(accounts.router,   prefix="/api")
app.include_router(settings.router,   prefix="/api")
app.include_router(snapshots.router,  prefix="/api")
app.include_router(dashboard.router,  prefix="/api")
app.include_router(history.router,    prefix="/api")
app.include_router(projection.router, prefix="/api")
app.include_router(fx.router,         prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Frontend static files + SPA fallback ──────────────────────────────────────
_HERE = os.path.dirname(__file__)
_FRONTEND_DIST = os.path.abspath(os.path.join(_HERE, "..", "..", "frontend", "dist"))


def _mount_frontend():
    """Mount Vite build output if present."""
    if not os.path.isdir(_FRONTEND_DIST):
        logger.warning("Frontend dist not found at %s — SPA not served", _FRONTEND_DIST)
        return

    assets_dir = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Serve index.html for SPA root and any non-API, non-asset paths
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Serve actual static file if it exists
        file_path = os.path.join(_FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html (SPA routing)
        index = os.path.join(_FRONTEND_DIST, "index.html")
        return FileResponse(index)

    logger.info("Frontend mounted from %s", _FRONTEND_DIST)


_mount_frontend()
