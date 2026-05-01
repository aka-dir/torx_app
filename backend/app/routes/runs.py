"""Run-scoped endpoints: mark download complete (delete uploads), submit feedback."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from .. import settings
from ..auth import User, current_user
from ..db import run_doc, run_feedback
from ..storage import delete_run

router = APIRouter()


class FeedbackIn(BaseModel):
    rating: int | None = None
    issue: str | None = None
    note: str | None = None


@router.post("/runs/{run_id}/complete")
def complete_run(run_id: str, user: User = Depends(current_user)) -> dict[str, Any]:
    """Call this after the client finishes its ZIP download.

    Brief: 'Uploaded images must be deleted immediately after download.'
    """
    if settings.SKIP_AUTH and not settings.PROJECT_ID:
        return {"run_id": run_id, "deleted_objects": 0}

    ref = run_doc(user.garage_id, run_id)
    if not ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found")
    deleted = delete_run(user.garage_id, run_id)
    ref.set({"status": "completed", "deleted_objects": deleted}, merge=True)
    return {"run_id": run_id, "deleted_objects": deleted}


@router.post("/runs/{run_id}/feedback")
def add_run_feedback(run_id: str, body: FeedbackIn, user: User = Depends(current_user)) -> dict[str, Any]:
    ref = run_doc(user.garage_id, run_id)
    if not ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found")
    payload = body.model_dump(exclude_none=True)
    payload["user"] = {"uid": user.uid, "email": user.email}
    added = run_feedback(user.garage_id, run_id).add(payload)
    return {"id": added[1].id}
