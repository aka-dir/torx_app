"""General product feedback (not tied to a run)."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import User, current_user
from ..db import global_feedback

router = APIRouter()


class GeneralFeedbackIn(BaseModel):
    message: str
    topic: str | None = None


@router.post("/feedback")
def submit_feedback(body: GeneralFeedbackIn, user: User = Depends(current_user)) -> dict[str, Any]:
    payload = body.model_dump(exclude_none=True)
    payload["created_at"] = time.time()
    payload["garage_id"] = user.garage_id
    payload["user"] = {"uid": user.uid, "email": user.email}
    added = global_feedback().add(payload)
    return {"id": added[1].id}
