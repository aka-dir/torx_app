"""Identity Platform ID token verification (no firebase-admin).

Uses google-auth + a cached JWKS fetch. Expects standard Identity Platform /
Firebase Auth tokens:

    iss = https://securetoken.google.com/<project_id>
    aud = <project_id>

Attach `garage_id` (required) and `admin` (optional) via custom claims
using the Identity Toolkit admin API when you provision users.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status
from google.auth import jwt as gjwt

from . import settings

_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)

# In-process cache; Cloud Run instances are short-lived so a simple TTL is enough.
_jwks_cache: dict[str, Any] = {"exp": 0.0, "certs": {}}
_JWKS_TTL_SECONDS = 3600


def _load_jwks() -> dict[str, Any]:
    """Fetch + cache Google's JWKS for Identity Platform tokens."""
    now = time.time()
    if now < _jwks_cache["exp"] and _jwks_cache["certs"]:
        return _jwks_cache["certs"]
    with httpx.Client(timeout=5.0) as client:
        resp = client.get(_JWKS_URL)
        resp.raise_for_status()
        certs = resp.json()
    _jwks_cache["certs"] = certs
    _jwks_cache["exp"] = now + _JWKS_TTL_SECONDS
    return certs


@dataclass(frozen=True)
class User:
    uid: str
    email: str
    garage_id: str
    admin: bool
    raw: dict[str, Any]


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header or not header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Missing bearer token. Send Authorization: Bearer <Identity Platform ID token>, "
                "or set env SKIP_AUTH=1 for local dev only."
            ),
        )
    return header.split(" ", 1)[1].strip()


def verify_token(token: str) -> dict[str, Any]:
    """Validate an ID token and return its decoded payload."""
    project = settings.require("GCP_PROJECT", settings.PROJECT_ID)
    try:
        certs = _load_jwks()
        decoded: dict[str, Any] = gjwt.decode(token, certs=certs, audience=project)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

    iss = decoded.get("iss") or ""
    expected_iss = f"https://securetoken.google.com/{project}"
    if iss != expected_iss:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid issuer")

    # google.auth.jwt.decode already checks exp; belt-and-suspenders:
    if float(decoded.get("exp", 0)) < time.time():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    return decoded


def current_user(request: Request) -> User:
    """FastAPI dependency returning the authenticated user."""
    if settings.SKIP_AUTH:
        # Dev shortcut — no Bearer token. Do not enable in Cloud Run.
        return User(
            uid="dev-skip-auth",
            email="dev@local",
            garage_id=settings.DEV_GARAGE_ID or "local-dev",
            admin=True,
            raw={"skip_auth": True},
        )
    token = _extract_bearer(request)
    claims = verify_token(token)
    garage_id = str(claims.get("garage_id") or "").strip()
    if not garage_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing garage_id claim — assign one to this user.",
        )
    return User(
        uid=str(claims.get("user_id") or claims.get("sub") or ""),
        email=str(claims.get("email") or ""),
        garage_id=garage_id,
        admin=bool(claims.get("admin")),
        raw=claims,
    )


def require_admin(user: User = Depends(current_user)) -> User:
    if settings.SKIP_AUTH:
        return user
    if not user.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user
