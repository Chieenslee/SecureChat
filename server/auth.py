import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict

from fastapi import HTTPException, Request, status


JWT_SECRET = os.environ.get("SECURE_CHAT_JWT_SECRET", "dev-secret-change-before-deploy")
JWT_TTL_SECONDS = 60 * 60 * 12


def create_access_token(user: Dict[str, Any]) -> str:
    """Tạo JWT HMAC-SHA256 tối giản cho bài lớn."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["chat_id"],
        "username": user["username"],
        "exp": int(time.time()) + JWT_TTL_SECONDS,
    }
    signing_input = f"{_b64_json(header)}.{_b64_json(payload)}"
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def verify_access_token(token: str) -> Dict[str, Any]:
    """Verify JWT và trả payload."""
    try:
        header_b64, payload_b64, signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    signing_input = f"{header_b64}.{payload_b64}"
    expected = _sign(signing_input)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    payload = json.loads(_b64_decode(payload_b64).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


def get_current_chat_id(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = verify_access_token(auth_header.removeprefix("Bearer ").strip())
    return payload["sub"]


def _b64_json(value: Dict[str, Any]) -> str:
    return _b64_encode(json.dumps(value, separators=(",", ":")).encode("utf-8"))


def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _sign(signing_input: str) -> str:
    digest = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return _b64_encode(digest)
