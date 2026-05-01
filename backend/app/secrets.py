"""Load the Gemini API key from Secret Manager and expose it to the kit.

inventory-photo-kit's `photosort.vision._resolve_api_key` already checks
GEMINI_API_KEY / GOOGLE_API_KEY env vars, so we simply inject the fetched
secret into the process environment at startup.
"""

from __future__ import annotations

import logging
import os

from . import settings

log = logging.getLogger(__name__)


def load_gemini_key_from_secret_manager() -> None:
    """Fetch the latest secret version and export it as GEMINI_API_KEY.

    Safe to call more than once; no-op if the env already has a key.
    """
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return

    project = settings.require("GCP_PROJECT", settings.PROJECT_ID)
    name = f"projects/{project}/secrets/{settings.GEMINI_SECRET_NAME}/versions/latest"

    # Imported lazily so that unit tests without GCP credentials can still import the module.
    from google.cloud import secretmanager  # type: ignore

    client = secretmanager.SecretManagerServiceClient()
    resp = client.access_secret_version(name=name)
    key = resp.payload.data.decode("utf-8").strip()
    if not key:
        raise RuntimeError(f"Secret {settings.GEMINI_SECRET_NAME} is empty")
    os.environ["GEMINI_API_KEY"] = key
    log.info("Loaded Gemini API key from Secret Manager")
