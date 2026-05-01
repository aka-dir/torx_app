"""Internal TorxFlow dashboard endpoints — admin claim required."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ..auth import User, require_admin
from ..db import client as fs_client, global_feedback

router = APIRouter()


@router.get("/dev/metrics")
def metrics(_: User = Depends(require_admin)) -> dict[str, Any]:
    """Lightweight aggregation: per-garage run counts + latest feedback."""
    db = fs_client()
    garages: list[dict[str, Any]] = []
    for g in db.collection("garages").stream():
        gid = g.id
        runs = list(db.collection("garages").document(gid).collection("runs").stream())
        garages.append(
            {
                "garage_id": gid,
                "name": (g.to_dict() or {}).get("name", gid),
                "run_count": len(runs),
                "last_run_at": max((r.to_dict() or {}).get("started_at", 0) for r in runs) if runs else 0,
            }
        )
    recent_feedback = [
        {**(s.to_dict() or {}), "id": s.id}
        for s in global_feedback().order_by("created_at", direction="DESCENDING").limit(20).stream()
    ]
    return {"garages": garages, "feedback": recent_feedback}
