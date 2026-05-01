"""TorxFlow SaaS — single Cloud Run service.

Serves the FastAPI JSON API under /api and the built Vite SPA at /.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import secrets, settings
from .routes import classify, dev, feedback, golden_sets, runs

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(title="TorxFlow", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

if settings.SKIP_AUTH:
    # Local mode: let the Vite dev server call the API without Identity Platform.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5192", "http://127.0.0.1:5192"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
def _startup() -> None:
    # In Cloud Run, load the Gemini key from Secret Manager.
    # Locally, GEMINI_API_KEY / GOOGLE_API_KEY already in env will short-circuit this.
    # If no cloud credentials exist, the local key file is handled by inventory-photo-kit.
    try:
        secrets.load_gemini_key_from_secret_manager()
    except Exception as e:
        # Do not crash the service if running without ADC — the kit will surface its own error.
        logging.getLogger(__name__).warning("Secret Manager load skipped: %s", e)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Register routers under /api.
for r in (classify.router, runs.router, golden_sets.router, feedback.router, dev.router):
    app.include_router(r, prefix="/api")


# ---------- Static SPA ----------
_WEB = Path(settings.WEB_DIST_DIR)
if _WEB.is_dir():
    # Docker/Cloud Run mode: FastAPI serves the built React app and the API together.
    app.mount("/assets", StaticFiles(directory=_WEB / "assets"), name="assets")

    @app.get("/")
    def _root() -> FileResponse:
        return FileResponse(_WEB / "index.html")

    @app.get("/{full_path:path}", response_model=None)
    def _spa_fallback(full_path: str) -> FileResponse | JSONResponse:
        # /api/* is already handled by routers above.
        candidate = _WEB / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_WEB / "index.html")
