"""
Optional development HTTP hook — not required for production SaaS.

Run (after ``pip install -e ".[http]"``):

.. code-block:: text

   uvicorn examples.http_dev:app --host 127.0.0.1 --port 8790
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

_ROOT = Path(__file__).resolve().parent.parent
# Sibling repo: ../photosort-dev-ui (same parent folder as this project)
_DEV_UI_DIR = _ROOT.parent / "photosort-dev-ui"
load_dotenv(_ROOT / ".env")

from copy import deepcopy

from photosort import config as cfg
from photosort.pipeline import classify_batch

app = FastAPI(
    title="inventory-photo-kit dev",
    version="1.0.0",
    description="Multipart POST with form field name `files`.",
)

# Dev-only: separate static UI (e.g. ../photosort-dev-ui) on another port may call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    out: dict = {
        "service": "inventory-photo-kit",
        "docs": "/docs",
        "health": "/health",
        "classify": "POST /classify?chunk_size=10&dedupe=0|1 — form `files`; dedupe=1 enables pHash representative batching",
    }
    if _DEV_UI_DIR.is_dir():
        out["dev_ui"] = "/ui/ — open in browser (same origin; no extra server)"
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify")
async def classify(
    files: list[UploadFile] = File(...),
    chunk_size: int = Query(
        default=10,
        ge=0,
        le=500,
        description="Max files per wave; 0 = single run (all files at once).",
    ),
    dedupe: int = Query(
        default=0,
        ge=0,
        le=1,
        description="1 = enable pHash duplicate clusters (one Gemini call per cluster).",
    ),
):
    if not files:
        raise HTTPException(status_code=400, detail="no files")
    batch: list[tuple[str, bytes]] = []
    for uf in files:
        batch.append((uf.filename or "upload", await uf.read()))
    cs = None if chunk_size == 0 else chunk_size
    settings = cfg.load_yaml("settings.yaml")
    if dedupe:
        settings = deepcopy(settings)
        prev = settings.get("dedupe") if isinstance(settings.get("dedupe"), dict) else {}
        settings["dedupe"] = {
            **prev,
            "enabled": True,
            "max_hamming": int(prev.get("max_hamming", 6)),
        }
    return JSONResponse(classify_batch(batch, chunk_size=cs, settings=settings))


# Sibling folder `photosort-dev-ui` — same host/port as API (one command for users).
if _DEV_UI_DIR.is_dir():
    app.mount(
        "/ui",
        StaticFiles(directory=str(_DEV_UI_DIR), html=True),
        name="dev_ui",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8790)
