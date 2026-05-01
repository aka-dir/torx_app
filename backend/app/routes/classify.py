"""POST /api/classify — wraps inventory-photo-kit's classify_batch.

Flow per request:
  1. Verify Identity Platform token, pull garage_id.
  2. Create a new `runs/{run_id}` Firestore doc.
  3. Stream uploads into GCS (runs/{gid}/{run_id}/in/...).
  4. Call photosort.classify_batch with (name, bytes) tuples.
  5. Persist counts on the run doc and return the kit's JSON report.
"""

from __future__ import annotations

import time
import uuid
from copy import deepcopy
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse

from photosort import config as kit_cfg
from photosort.pipeline import classify_batch

from .. import settings
from ..auth import User, current_user
from ..db import run_doc, runs
from ..storage import upload_original

router = APIRouter()


@router.post("/classify")
async def classify(
    files: list[UploadFile] = File(...),
    chunk_size: int = Query(10, ge=0, le=500),
    dedupe: int = Query(0, ge=0, le=1),
    user: User = Depends(current_user),
) -> JSONResponse:
    if not files:
        return JSONResponse({"detail": "no files"}, status_code=400)

    # Each upload batch gets a short run id for storage paths and dashboard records.
    run_id = uuid.uuid4().hex[:12]
    started = time.time()

    # Read bytes once, write to GCS, and hand to the kit.
    batch: list[tuple[str, bytes]] = []
    for uf in files:
        name = uf.filename or "upload"
        data = await uf.read()
        upload_original(user.garage_id, run_id, name, data, uf.content_type)
        batch.append((name, data))

    # The kit reads model, prompt, image resize, and pHash duplicate settings from YAML.
    settings_yaml = kit_cfg.load_yaml("settings.yaml")
    if dedupe:
        # The UI decides whether pHash duplicate grouping is enabled for this run.
        settings_yaml = deepcopy(settings_yaml)
        prev = settings_yaml.get("dedupe") if isinstance(settings_yaml.get("dedupe"), dict) else {}
        settings_yaml["dedupe"] = {
            **(prev or {}),
            "enabled": True,
            "max_hamming": int((prev or {}).get("max_hamming", 6)),
        }

    cs = None if chunk_size == 0 else chunk_size
    # Main handoff: backend passes raw bytes to the reusable photo classification kit.
    report: dict[str, Any] = classify_batch(
        batch, chunk_size=cs, settings=settings_yaml, emit_summary_table=False
    )

    items = report.get("items") or []
    unclassified = sum(1 for it in items if not it.get("ok"))
    duration = round(time.time() - started, 2)
    if not (settings.SKIP_AUTH and not settings.PROJECT_ID):
        # Minimal run record — useful for the internal dashboard.
        run_doc(user.garage_id, run_id).set(
            {
                "run_id": run_id,
                "started_at": started,
                "duration_s": duration,
                "uploaded_count": len(batch),
                "unclassified_count": unclassified,
                "dedupe": bool(dedupe),
                "model": report.get("model"),
                "user": {"uid": user.uid, "email": user.email},
                "status": "done",
            },
            merge=True,
        )

    report["run_id"] = run_id
    return JSONResponse(report)


@router.get("/runs")
def list_runs(user: User = Depends(current_user)) -> list[dict[str, Any]]:
    q = runs(user.garage_id).order_by("started_at", direction="DESCENDING").limit(50)
    return [{**(s.to_dict() or {}), "id": s.id} for s in q.stream()]
