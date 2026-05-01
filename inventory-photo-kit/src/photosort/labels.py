"""Map free-form model text to a single allowed inventory label."""

import re


def _clean_vehicle_guess(raw: str) -> str:
    v = (raw or "").strip()
    if not v:
        return ""
    low = v.lower()
    if low in ("unknown", "n/a", "n.v.t.", "onbekend", "none", "unclear", "not visible"):
        return ""
    return v


def parse_classify_reply(raw: str, allowed: list[str]) -> tuple[str, str]:
    """
    Line 1 → normalized inventory ``label``. Optional ``VEHICLE:`` line → make/model string.
    """
    raw = (raw or "").strip()
    if not raw:
        return normalize_label("", allowed), ""
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    label_line = lines[0] if lines else ""
    label = normalize_label(label_line, allowed)
    vehicle = ""
    # The prompt asks for an optional VEHICLE line; accept English and Dutch keys.
    _vh_keys = ("vehicle:", "voertuig:", "auto:", "car:")
    for ln in lines[1:]:
        low = ln.lower()
        for key in _vh_keys:
            if low.startswith(key):
                vehicle = _clean_vehicle_guess(ln.split(":", 1)[1])
                break
        if vehicle:
            break
    # Models often put the tag on the same line as the label or mid-text; scan full reply (EN/NL).
    if not vehicle:
        m = re.search(r"(?i)(?:vehicle|voertuig|auto|car)\s*:\s*([^\n\r]+)", raw)
        if m:
            vehicle = _clean_vehicle_guess(m.group(1))
    return label, vehicle


def normalize_label(raw: str, allowed: list[str]) -> str:
    """
    If ``allowed`` is empty, returns stripped ``raw``.
    Otherwise picks the longest allowed label that appears as a substring in ``raw`` (case-insensitive).
    Falls back to ``unclassified`` when present in ``allowed``, else returns ``raw``.
    """
    raw = (raw or "").strip()
    if not allowed:
        return raw
    allow = set(allowed)
    t = raw.lower()
    for noise in ("category:", "answer:", "`", '"', "*"):
        t = t.replace(noise, " ")
    # Longest label wins first, so specific labels beat broad substrings.
    for cand in sorted(allow, key=len, reverse=True):
        for variant in (cand, cand.replace("_", " "), cand.replace("_", "-")):
            if variant.lower() in t:
                return cand
    if "niet_geclassificeerd" in allow:
        return "niet_geclassificeerd"
    return "unclassified" if "unclassified" in allow else raw
