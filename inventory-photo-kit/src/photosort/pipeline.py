"""
Single entry point for hosts (FastAPI, workers, CLI): raw file bytes in, structured report out.

No UI — your SaaS or scripts call :func:`classify_batch`.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from photosort import config as cfg
from photosort import image_prep
from photosort import labels as labelutil
from photosort import reporting
from photosort import vision

_root = cfg.project_root()
# Load local development secrets/config without forcing the host app to do it.
load_dotenv(_root / ".env")
load_dotenv()


def _classify_inner(
    files: list[tuple[str, bytes]],
    settings: dict[str, Any],
    prompts: dict[str, Any],
    *,
    emit_summary_table: bool,
) -> dict[str, Any]:
    """Classify one contiguous list of files (single batch report)."""
    prompt = str(prompts.get("classify_prompt") or "").strip()
    allowed = list(prompts.get("allowed_labels") or [])
    model = str(settings.get("model") or "gemini-2.5-flash")
    gen_max = int((settings.get("generation") or {}).get("max_output_tokens", 256))
    gap = float((settings.get("timing") or {}).get("gap_seconds", 4))
    retries = int((settings.get("timing") or {}).get("max_retries", 6))

    dedupe_cfg = settings.get("dedupe")
    rep_idx: list[int] | None = None
    if isinstance(dedupe_cfg, dict) and dedupe_cfg.get("enabled"):
        from photosort.features import phash_dedupe

        # Build representative indexes so near-duplicate images reuse one Gemini result.
        max_h = int(dedupe_cfg.get("max_hamming", 6))
        rep_idx = phash_dedupe.representative_per_index(files, max_hamming=max_h)

    items: list[dict[str, Any]] = []
    usages: list[dict[str, int | None]] = []
    upload_total = prepared_total = 0
    n_prepare_err = n_infer_err = n_classified = 0
    t0 = time.time()

    def _sleep_gap_before_api(idx: int) -> None:
        if idx <= 0:
            return
        if rep_idx is None:
            time.sleep(gap)
            return
        prev_calls_api = (idx - 1) == rep_idx[idx - 1]
        this_calls_api = idx == rep_idx[idx]
        if prev_calls_api and this_calls_api:
            time.sleep(gap)

    for idx, (name, raw) in enumerate(files):
        upload_total += len(raw)

        try:
            # Normalize every upload to a smaller JPEG before sending it to Gemini.
            jpeg, prep = image_prep.prepare_for_model(raw, settings)
        except Exception as e:
            n_prepare_err += 1
            items.append({"file": name, "ok": False, "stage": "prepare", "error": str(e)})
            continue

        prepared_total += prep["output_bytes"]

        # Duplicate of same pHash cluster: copy label from representative (no Gemini).
        if rep_idx is not None and idx != rep_idx[idx]:
            src = items[rep_idx[idx]]
            if src.get("ok"):
                usages.append({"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
                n_classified += 1
                items.append(
                    {
                        "file": name,
                        "ok": True,
                        "label": src["label"],
                        "vehicle": src.get("vehicle") or "",
                        "raw_response": src.get("raw_response"),
                        "prep": prep,
                        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                        "phash_dup_of": files[rep_idx[idx]][0],
                    }
                )
                continue
            # Representative failed; fall through and call Gemini for this file.

        _sleep_gap_before_api(idx)

        try:
            text, usage = "", {}
            for attempt in range(retries):
                try:
                    # One model call returns both the slot label and optional vehicle text.
                    text, usage = vision.classify_image(
                        jpeg,
                        prompt=prompt,
                        model=model,
                        max_output_tokens=gen_max,
                    )
                    break
                except Exception as e:
                    err = str(e)
                    retryable = (
                        "429" in err
                        or "quota" in err.lower()
                        or "rate" in err.lower()
                        or "ResourceExhausted" in err
                    )
                    if not retryable or attempt == retries - 1:
                        raise
                    # Back off on quota/rate-limit errors instead of failing immediately.
                    time.sleep(min(120.0, 8.0 * (attempt + 1)))

            usages.append(usage)
            # Convert free-form model text into one allowed label used by the UI.
            label, vehicle = labelutil.parse_classify_reply(text, allowed)
            n_classified += 1
            items.append(
                {
                    "file": name,
                    "ok": True,
                    "label": label,
                    "vehicle": vehicle,
                    "raw_response": text,
                    "prep": prep,
                    "usage": usage,
                }
            )
        except Exception as e:
            n_infer_err += 1
            items.append({"file": name, "ok": False, "stage": "inference", "prep": prep, "error": str(e)})

    tok_sum = reporting.merge_usage_rows(usages)
    n_in = len(files)
    n_prep_ok = n_in - n_prepare_err

    _, body = reporting.build_summary_rows(
        n_files_in=n_in,
        n_prepared=n_prep_ok,
        n_classified=n_classified,
        n_prepare_errors=n_prepare_err,
        n_infer_errors=n_infer_err,
        upload_total=upload_total,
        prepared_total=prepared_total,
        token_sums=tok_sum,
    )
    body["items"] = items
    body["duration_seconds"] = round(time.time() - t0, 3)
    body["model"] = model
    out = reporting.build_report(body)
    if emit_summary_table:
        print(out.get("table_ascii", ""), flush=True)
    return out


def classify_batch(
    files: list[tuple[str, bytes]],
    *,
    settings: dict[str, Any] | None = None,
    prompts: dict[str, Any] | None = None,
    emit_summary_table: bool = True,
    chunk_size: int | None = None,
) -> dict[str, Any]:
    """
    Classify images. Optionally splits into chunks (e.g. 10 files per API “wave”) so long
    runs do not rely on one giant request.

    :param chunk_size: If ``None`` or ``<= 0``, all files are processed in one run (legacy shape).
        If set (e.g. ``10``), and ``len(files)`` exceeds it, returns a **chunked** dict (see below).
    :returns: Either the classic single-batch dict, or when chunked:

        .. code-block:: text

           mode, chunk_size, total_files, chunk_count, chunks[{chunk_index, files_in_chunk, result}],
           merged{items, tokens, duration_seconds, model}
    """
    settings = settings if settings is not None else cfg.load_yaml("settings.yaml")
    prompts = prompts if prompts is not None else cfg.load_yaml("prompts.yaml")

    use_chunks = chunk_size is not None and chunk_size > 0 and len(files) > chunk_size
    if not use_chunks:
        return _classify_inner(files, settings, prompts, emit_summary_table=emit_summary_table)

    assert chunk_size is not None
    # Large uploads are split into smaller waves; the response is merged for the UI.
    chunks_out: list[dict[str, Any]] = []
    chunk_index = 0
    for start in range(0, len(files), chunk_size):
        sub = files[start : start + chunk_size]
        r = _classify_inner(sub, settings, prompts, emit_summary_table=emit_summary_table)
        chunks_out.append(
            {
                "chunk_index": chunk_index,
                "files_in_chunk": [n for n, _ in sub],
                "result": r,
            }
        )
        chunk_index += 1

    merged_items: list[dict[str, Any]] = []
    merged_tokens: dict[str, int] = {}
    total_duration = 0.0
    model: str | None = None
    for c in chunks_out:
        res = c["result"]
        merged_items.extend(res.get("items") or [])
        mt = res.get("tokens") or {}
        if isinstance(mt, dict):
            for k, v in mt.items():
                merged_tokens[k] = merged_tokens.get(k, 0) + int(v)
        total_duration += float(res.get("duration_seconds") or 0)
        if model is None:
            model = res.get("model")

    return {
        "mode": "chunked",
        "chunk_size": chunk_size,
        "total_files": len(files),
        "chunk_count": len(chunks_out),
        "chunks": chunks_out,
        "merged": {
            "items": merged_items,
            "tokens": merged_tokens,
            "duration_seconds": round(total_duration, 3),
            "model": model,
        },
    }


def classify_paths(paths: list[Path], **kwargs: Any) -> dict[str, Any]:
    """Convenience: read paths from disk and run :func:`classify_batch`."""
    files: list[tuple[str, bytes]] = []
    for p in paths:
        files.append((p.name, p.read_bytes()))
    return classify_batch(files, **kwargs)
