"""Load YAML configuration from the project ``config/`` directory."""

from __future__ import annotations

import os
from pathlib import Path

import yaml

# Override config directory (absolute or relative path) for tests or multi-tenant hosting.
_ENV_CONFIG_DIR = "PHOTOSORT_CONFIG_DIR"


def project_root() -> Path:
    """Repository root: ``.../inventory-photo-kit`` (parent of ``src/``)."""
    return Path(__file__).resolve().parent.parent.parent


def config_dir() -> Path:
    """Directory containing ``settings.yaml`` and ``prompts.yaml``."""
    override = os.environ.get(_ENV_CONFIG_DIR, "").strip()
    if override:
        return Path(override)
    return project_root() / "config"


def load_yaml(name: str) -> dict:
    """Load one YAML file from :func:`config_dir`. Returns empty dict if missing or invalid."""
    path = config_dir() / name
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else {}
