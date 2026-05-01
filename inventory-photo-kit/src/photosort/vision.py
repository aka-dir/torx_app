"""
Gemini vision inference via the official ``google-genai`` SDK.

API key resolution (first match wins):

1. Environment ``GEMINI_API_KEY`` or ``GOOGLE_API_KEY`` (or ``.env`` via host).
2. Path in ``GEMINI_API_KEY_FILE`` (UTF-8 text file, key only or one line).
3. ``apikey_test`` or ``apikey__.txt`` in the inventory-photo-kit repo root, then
   ``apikey__.txt`` in its parent folder
   (so a key next to the repo works).
"""

from __future__ import annotations

import os
from pathlib import Path


def _kit_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _resolve_api_key() -> str:
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        v = (os.environ.get(name) or "").strip()
        if v:
            return v
    file_env = (os.environ.get("GEMINI_API_KEY_FILE") or "").strip()
    candidates: list[Path] = []
    if file_env:
        candidates.append(Path(file_env))
    root = _kit_root()
    # Local Docker/dev default: mount or create this file with only the key inside.
    candidates.append(root / "apikey_test")
    candidates.append(root / "apikey__.txt")
    candidates.append(root.parent / "apikey__.txt")
    for path in candidates:
        try:
            if path.is_file():
                text = path.read_text(encoding="utf-8").strip()
                if text:
                    return text.splitlines()[0].strip()
        except OSError:
            continue
    return ""


def classify_image(
    jpeg_bytes: bytes,
    *,
    prompt: str,
    model: str,
    max_output_tokens: int = 256,
) -> tuple[str, dict[str, int | None]]:
    """
    One multimodal call: text prompt + JPEG image.

    Returns ``(model_text, token_usage_dict)`` where usage keys align with reporting:
    ``prompt_tokens``, ``completion_tokens``, ``total_tokens`` (when the API returns them).
    """
    from google import genai
    from google.genai import types

    key = _resolve_api_key()
    if not key:
        raise RuntimeError(
            "No API key: set GEMINI_API_KEY / GOOGLE_API_KEY, or GEMINI_API_KEY_FILE, "
            "or place the key in inventory-photo-kit/apikey_test (see docs/CONFIGURATION.md)."
        )

    client = genai.Client(api_key=key)
    contents: list[types.Part] = [
        types.Part.from_text(text=prompt),
        types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
    ]
    resp = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(max_output_tokens=max_output_tokens),
    )

    usage: dict[str, int | None] = {}
    um = getattr(resp, "usage_metadata", None)
    if um is not None:
        for key_name, attr in (
            ("prompt_tokens", "prompt_token_count"),
            ("completion_tokens", "candidates_token_count"),
            ("total_tokens", "total_token_count"),
        ):
            v = getattr(um, attr, None)
            if v is not None:
                usage[key_name] = int(v)

    text = ""
    try:
        text = (resp.text or "").strip()
    except Exception:
        pass
    return text, usage
