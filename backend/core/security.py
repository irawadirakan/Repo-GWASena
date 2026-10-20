"""Hash kata sandi dan token akses (FR-01), hanya memakai pustaka standar Python."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from backend.core.config import settings

_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, iterations, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(body: str) -> str:
    return _b64(hmac.new(settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())


def create_token(user_id: int, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": int(time.time()) + settings.TOKEN_EXPIRE_HOURS * 3600}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def decode_token(token: str) -> dict | None:
    try:
        body, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(body)):
            return None
        payload = json.loads(_unb64(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except (ValueError, json.JSONDecodeError):
        return None
