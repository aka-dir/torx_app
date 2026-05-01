"""Firestore helpers scoped per garage.

Layout:

    garages/{gid}
    garages/{gid}/golden_sets/{id}
    garages/{gid}/runs/{id}
    garages/{gid}/runs/{id}/feedback/{id}
    feedback_global/{id}
"""

from __future__ import annotations

from typing import Any

from google.cloud import firestore  # type: ignore

from . import settings

_client: firestore.Client | None = None


def client() -> firestore.Client:
    global _client
    if _client is None:
        # Reuse one Firestore client per process; Cloud Run may handle many requests.
        _client = firestore.Client(project=settings.PROJECT_ID or None, database=settings.FIRESTORE_DATABASE)
    return _client


def garage_doc(garage_id: str) -> firestore.DocumentReference:
    # All customer data is scoped below one garage document.
    return client().collection("garages").document(garage_id)


def golden_sets(garage_id: str) -> firestore.CollectionReference:
    return garage_doc(garage_id).collection("golden_sets")


def runs(garage_id: str) -> firestore.CollectionReference:
    return garage_doc(garage_id).collection("runs")


def run_doc(garage_id: str, run_id: str) -> firestore.DocumentReference:
    return runs(garage_id).document(run_id)


def run_feedback(garage_id: str, run_id: str) -> firestore.CollectionReference:
    return run_doc(garage_id, run_id).collection("feedback")


def global_feedback() -> firestore.CollectionReference:
    return client().collection("feedback_global")


def to_dict(snapshot) -> dict[str, Any]:
    d = snapshot.to_dict() or {}
    d["id"] = snapshot.id
    return d
