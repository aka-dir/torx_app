"""
Resize and encode images to JPEG before sending to the vision API.

Rules are driven by ``settings.yaml`` → ``image`` and ``image.scaling``.
"""

from __future__ import annotations

import io
from typing import Any

from PIL import Image


def _long_edge(width: int, height: int) -> int:
    return max(width, height)


def pick_max_side(long_edge: int, image_cfg: dict[str, Any]) -> int:
    """Pick max thumbnail edge (px) from adaptive rules or fixed cap."""
    sc = image_cfg.get("scaling") or {}
    mode = str(sc.get("mode", "fixed")).lower()
    cap = int(sc.get("hard_cap_px", 2048))

    if mode == "fixed":
        # Fixed mode uses one configured size for every upload.
        ms = int(sc.get("max_side_px", image_cfg.get("max_side_px") or 896))
        return max(64, min(ms, cap))

    # Adaptive mode chooses a smaller target for smaller originals.
    rules = list(sc.get("rules") or [])
    for r in sorted(rules, key=lambda x: -int(x.get("min_long_edge", 0))):
        if long_edge >= int(r.get("min_long_edge", 0)):
            ms = int(r["max_side"])
            return max(64, min(ms, cap))
    return min(896, cap)


def prepare_for_model(raw: bytes, settings: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    """
    Decode arbitrary image bytes, resize, emit JPEG for the model.

    Returns ``(jpeg_bytes, prep_metadata)``.
    """
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w0, h0 = im.size
    le = _long_edge(w0, h0)
    image_cfg = settings.get("image") or {}
    if "max_side_px" in image_cfg and "scaling" not in image_cfg:
        image_cfg = {
            **image_cfg,
            "scaling": {"mode": "fixed", "max_side_px": int(image_cfg["max_side_px"])},
        }
    max_side = pick_max_side(le, image_cfg)
    q = int(image_cfg.get("jpeg_quality", 88))

    # Keep aspect ratio; only the longest edge is capped.
    im2 = im.copy()
    im2.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    w1, h1 = im2.size
    buf = io.BytesIO()
    im2.save(buf, format="JPEG", quality=q, optimize=True)
    out = buf.getvalue()

    return out, {
        "upload_bytes": len(raw),
        "width_in": w0,
        "height_in": h0,
        "width_out": w1,
        "height_out": h1,
        "output_bytes": len(out),
        "max_side_used": max_side,
        "jpeg_quality": q,
    }
