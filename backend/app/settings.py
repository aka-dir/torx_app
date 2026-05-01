"""Runtime settings pulled from environment.

Cloud Run populates GCP_PROJECT automatically; other values come from
--update-env-vars / --set-secrets during deploy.
"""

from __future__ import annotations

import os


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name, default)
    return v.strip() if isinstance(v, str) else default


# GCP project id (required at runtime).
PROJECT_ID: str = _env("GCP_PROJECT") or _env("GOOGLE_CLOUD_PROJECT")

# Identity Platform: project id is also the JWT `aud`. Optional tenant id if using tenants.
IDP_TENANT_ID: str = _env("IDP_TENANT_ID")

# GCS bucket for per-run uploads. Objects live under runs/{garage_id}/{run_id}/.
GCS_BUCKET: str = _env("GCS_BUCKET")

# Firestore database id ("(default)" for the default database).
FIRESTORE_DATABASE: str = _env("FIRESTORE_DATABASE", "(default)")

# Secret Manager name for the Gemini API key (short name, not full resource).
GEMINI_SECRET_NAME: str = _env("GEMINI_SECRET_NAME", "GEMINI_API_KEY")

# Where the built Vite SPA lives inside the container.
WEB_DIST_DIR: str = _env("WEB_DIST_DIR", "web/dist")

# Local dev only: skip Identity Platform and use a fixed tenant id + admin.
# NEVER set in production.
SKIP_AUTH: bool = _env("SKIP_AUTH", "").lower() in ("1", "true", "yes")
DEV_GARAGE_ID: str = _env("DEV_GARAGE_ID", "local-dev")


def require(name: str, value: str) -> str:
    """Fail fast when a required env var is missing."""
    if not value:
        raise RuntimeError(f"Required env var missing: {name}")
    return value
