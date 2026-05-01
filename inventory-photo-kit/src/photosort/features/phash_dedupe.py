"""
pHash (ImageHash + Pillow): cluster near-duplicate images by Hamming distance.
See settings.yaml → dedupe.
"""

from __future__ import annotations

import io

from PIL import Image


def _phash(raw: bytes):
    import imagehash

    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((256, 256))
    return imagehash.phash(im)


def representative_per_index(files: list[tuple[str, bytes]], *, max_hamming: int) -> list[int]:
    """Each index maps to the smallest index in its cluster (that file gets Gemini)."""
    n = len(files)
    if n == 0:
        return []
    hashes = []
    for _, raw in files:
        try:
            hashes.append(_phash(raw))
        except Exception:
            hashes.append(None)

    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        pi, pj = find(i), find(j)
        if pi == pj:
            return
        if pi < pj:
            parent[pj] = pi
        else:
            parent[pi] = pj

    for i in range(n):
        for j in range(i + 1, n):
            hi, hj = hashes[i], hashes[j]
            if hi is None or hj is None:
                continue
            if hi - hj <= max_hamming:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        r = find(i)
        groups.setdefault(r, []).append(i)

    rep = [0] * n
    for members in groups.values():
        m = min(members)
        for i in members:
            rep[i] = m
    return rep
