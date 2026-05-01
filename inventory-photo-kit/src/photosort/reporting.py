"""Batch summary metrics and a plain-text ASCII table for logs or dashboards."""

from __future__ import annotations

from typing import Any


def merge_usage_rows(usages: list[dict[str, int | None]]) -> dict[str, int]:
    """Sum token fields across per-image usage dicts."""
    out: dict[str, int] = {}
    for u in usages:
        for k in ("prompt_tokens", "completion_tokens", "total_tokens"):
            v = u.get(k)
            if v is not None:
                out[k] = out.get(k, 0) + int(v)
    return out


def format_bytes(n: int) -> str:
    if n >= 1024 * 1024:
        return f"{n / (1024 * 1024):.2f} MiB"
    if n >= 1024:
        return f"{n / 1024:.1f} KiB"
    return f"{n} B"


def build_summary_rows(
    n_files_in: int,
    n_prepared: int,
    n_classified: int,
    n_prepare_errors: int,
    n_infer_errors: int,
    upload_total: int,
    prepared_total: int,
    token_sums: dict[str, int],
) -> tuple[list[tuple[str, str]], dict[str, Any]]:
    summary_rows: list[tuple[str, str]] = [
        ("Files received", str(n_files_in)),
        ("Prepared (JPEG ok)", str(n_prepared)),
        ("Classified ok", str(n_classified)),
        ("Prepare errors", str(n_prepare_errors)),
        ("Inference errors", str(n_infer_errors)),
        ("Upload total", f"{upload_total} B ({format_bytes(upload_total)})"),
        ("After prep total (API input bytes)", f"{prepared_total} B ({format_bytes(prepared_total)})"),
        (
            "Size ratio (prepared / upload)",
            f"{(prepared_total / upload_total):.4f}" if upload_total else "n/a",
        ),
    ]
    for k in ("prompt_tokens", "completion_tokens", "total_tokens"):
        if k in token_sums:
            summary_rows.append((f"Tokens sum ({k})", str(token_sums[k])))

    body: dict[str, Any] = {
        "summary_rows": summary_rows,
        "counts": {
            "files_received": n_files_in,
            "prepared_ok": n_prepared,
            "classified_ok": n_classified,
            "prepare_errors": n_prepare_errors,
            "infer_errors": n_infer_errors,
        },
        "bytes": {
            "upload_total": upload_total,
            "prepared_total": prepared_total,
            "ratio_prepared_over_upload": (
                round(prepared_total / upload_total, 6) if upload_total else None
            ),
        },
        "tokens": token_sums,
    }
    return summary_rows, body


def build_report(payload: dict[str, Any]) -> dict[str, Any]:
    """Attach ``table_ascii`` string to the payload dict (mutates copy)."""
    p = dict(payload)
    lines = [
        "+" + "-" * 44 + "+" + "-" * 18 + "+",
        "| " + "Metric".ljust(42) + " | " + "Value".ljust(16) + " |",
        "+" + "-" * 44 + "+" + "-" * 18 + "+",
    ]
    for label, val in p.get("summary_rows") or []:
        lines.append("| " + str(label)[:42].ljust(42) + " | " + str(val)[:16].ljust(16) + " |")
    lines.append("+" + "-" * 44 + "+" + "-" * 18 + "+")
    p["table_ascii"] = "\n".join(lines)
    return p
