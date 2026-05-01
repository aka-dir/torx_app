"""CRUD + duplicate for per-garage golden sets."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import User, current_user
from ..db import golden_sets, to_dict

router = APIRouter()


class StuckImage(BaseModel):
    position: int = Field(ge=1)
    gcs_uri: str


class GoldenSetIn(BaseModel):
    name: str
    categories: list[str] = Field(default_factory=list)
    max_per_category: int = Field(default=1, ge=1, le=50)
    stuck_images: list[StuckImage] = Field(default_factory=list)


@router.get("/golden-sets")
def list_sets(user: User = Depends(current_user)) -> list[dict[str, Any]]:
    return [to_dict(s) for s in golden_sets(user.garage_id).stream()]


@router.post("/golden-sets")
def create_set(body: GoldenSetIn, user: User = Depends(current_user)) -> dict[str, Any]:
    payload = body.model_dump()
    payload["created_at"] = time.time()
    added = golden_sets(user.garage_id).add(payload)
    return {"id": added[1].id, **payload}


@router.put("/golden-sets/{set_id}")
def update_set(set_id: str, body: GoldenSetIn, user: User = Depends(current_user)) -> dict[str, Any]:
    ref = golden_sets(user.garage_id).document(set_id)
    if not ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    payload = body.model_dump()
    payload["updated_at"] = time.time()
    ref.set(payload, merge=True)
    return {"id": set_id, **payload}


@router.delete("/golden-sets/{set_id}")
def delete_set(set_id: str, user: User = Depends(current_user)) -> dict[str, str]:
    golden_sets(user.garage_id).document(set_id).delete()
    return {"id": set_id}


@router.post("/golden-sets/{set_id}/duplicate")
def duplicate_set(set_id: str, user: User = Depends(current_user)) -> dict[str, Any]:
    src = golden_sets(user.garage_id).document(set_id).get()
    if not src.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    data = src.to_dict() or {}
    data["name"] = f"{data.get('name', 'set')} (copy)"
    data["created_at"] = time.time()
    added = golden_sets(user.garage_id).add(data)
    return {"id": added[1].id, **data}
