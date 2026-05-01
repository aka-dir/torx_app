"""GCS helpers: upload per-run originals and delete everything after download."""

from __future__ import annotations

from typing import Iterable

from google.cloud import storage  # type: ignore

from . import settings

_client: storage.Client | None = None


def local_no_cloud() -> bool:
    """Allow the sorter to run locally without Google Cloud credentials."""
    return settings.SKIP_AUTH and not settings.GCS_BUCKET


def _bucket() -> storage.Bucket:
    global _client
    if _client is None:
        # Create the GCS client lazily so local mode can run without cloud credentials.
        _client = storage.Client(project=settings.PROJECT_ID or None)
    return _client.bucket(settings.require("GCS_BUCKET", settings.GCS_BUCKET))


def run_prefix(garage_id: str, run_id: str) -> str:
    # Keep every uploaded original for one run under a predictable prefix.
    return f"runs/{garage_id}/{run_id}/"


def upload_original(garage_id: str, run_id: str, filename: str, data: bytes, content_type: str | None = None) -> str:
    """Store an uploaded image and return its gs:// URI."""
    if local_no_cloud():
        # Local development keeps everything in memory and skips Google Cloud Storage.
        return f"local://{run_prefix(garage_id, run_id)}in/{filename}"
    blob = _bucket().blob(run_prefix(garage_id, run_id) + "in/" + filename)
    blob.upload_from_string(data, content_type=content_type or "application/octet-stream")
    return f"gs://{blob.bucket.name}/{blob.name}"


def delete_run(garage_id: str, run_id: str) -> int:
    """Delete every object under runs/{garage}/{run}/. Returns deleted count."""
    if local_no_cloud():
        return 0
    bkt = _bucket()
    prefix = run_prefix(garage_id, run_id)
    count = 0
    for blob in bkt.list_blobs(prefix=prefix):
        blob.delete()
        count += 1
    return count


def iter_run_objects(garage_id: str, run_id: str) -> Iterable[storage.Blob]:
    return _bucket().list_blobs(prefix=run_prefix(garage_id, run_id))
