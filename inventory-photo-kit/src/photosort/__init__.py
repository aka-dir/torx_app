"""
Vehicle inventory photo classification — reusable library (no UI).

Primary API: :func:`photosort.pipeline.classify_batch`.
"""

from __future__ import annotations

from .pipeline import classify_batch, classify_paths

__version__ = "1.0.0"

__all__ = ["__version__", "classify_batch", "classify_paths"]
