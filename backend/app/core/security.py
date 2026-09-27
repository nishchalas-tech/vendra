"""
Vendra Security, Password Hashing & Token Signing (backend/app/core/security.py)
Uses PBKDF2-HMAC-SHA256 with per-user cryptographic salt and constant-time comparison.
Uses JWT_SECRET_KEY (never GEMINI_API_KEY) for HMAC-SHA256 session token signing.
Never stores or exposes plaintext passwords or password hashes.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.core.config import settings


ITERATIONS = 210_000


def hash_password(password: str) -> str:
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        ITERATIONS,
    )
    return f"pbkdf2_sha256${ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not password or not stored_hash:
        return False
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_hex = parts[3]
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False


def generate_session_token() -> str:
    raw_id = f"vnd_{secrets.token_urlsafe(32)}"
    sig = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        raw_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{raw_id}.{sig}"


def get_session_expiry_iso(days: int = 14) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def verify_webhook_signature(secret: str, provided_secret: Optional[str]) -> bool:
    if not secret:
        return True
    if not provided_secret:
        return False
    return hmac.compare_digest(secret.encode("utf-8"), provided_secret.encode("utf-8"))
