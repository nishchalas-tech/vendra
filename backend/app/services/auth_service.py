"""
Authentication & Profile Service (backend/app/services/auth_service.py)
Implements Section 9 & Section 11:
- Email uniqueness validation
- Secure PBKDF2-HMAC-SHA256 password hashing
- Never stores or exposes plaintext passwords or password hashes
- Persistent sessions
- Founder profile creation & editing
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from app.core.security import (
    generate_session_token,
    get_session_expiry_iso,
    hash_password,
    verify_password,
)
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_one, get_db


def _strip_sensitive_user_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    clean = dict(row)
    clean.pop("password_hash", None)
    clean["is_demo_user"] = bool(clean.get("is_demo_user", 0))
    clean.setdefault("company_name", "")
    return clean


def register_user(
    full_name: str,
    email: str,
    password: str,
    phone: str = "",
    city: str = "Bengaluru",
    state: str = "Karnataka",
    company_name: str = "",
    is_demo_user: bool = False,
) -> Tuple[Dict[str, Any], str]:
    clean_name = (full_name or "").strip()
    clean_email = (email or "").strip().lower()
    clean_city = (city or "Bengaluru").strip() or "Bengaluru"
    clean_state = (state or "Karnataka").strip() or "Karnataka"
    clean_phone = (phone or "").strip()
    clean_company = (company_name or "").strip()

    if not clean_name:
        raise ValueError("Full name is required.")
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    pwd_hash = hash_password(password)
    now = utc_now_iso()
    user_id = new_id("usr")
    profile_id = new_id("prf")
    token = generate_session_token()
    expires_at = get_session_expiry_iso(14)

    with get_db() as conn:
        existing = fetch_one(conn, "SELECT id FROM users WHERE email = ?", (clean_email,))
        if existing:
            raise ValueError("An account with this email already exists.")

        conn.execute(
            """
            INSERT INTO users (
                id, full_name, email, password_hash, company_name, phone, city, state,
                is_demo_user, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                clean_name,
                clean_email,
                pwd_hash,
                clean_company,
                clean_phone,
                clean_city,
                clean_state,
                1 if is_demo_user else 0,
                now,
                now,
            ),
        )

        conn.execute(
            """
            INSERT INTO founder_profiles (
                id, user_id, full_name, company_name, phone, city, state,
                business_experience, skills, industry_interests,
                available_capital, preferred_product_categories,
                available_time, preferred_sourcing_location,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                user_id,
                clean_name,
                clean_company,
                clean_phone,
                clean_city,
                clean_state,
                "",
                "",
                "",
                0.0,
                "",
                "",
                f"{clean_city}, {clean_state}",
                now,
                now,
            ),
        )

        conn.execute(
            """
            INSERT INTO sessions (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, now, expires_at),
        )

        user_row = fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,))

    return _strip_sensitive_user_fields(user_row), token


def authenticate_user(email: str, password: str) -> Tuple[Dict[str, Any], str]:
    clean_email = (email or "").strip().lower()
    if not clean_email or not password:
        raise ValueError("Incorrect email or password.")

    with get_db() as conn:
        user_row = fetch_one(conn, "SELECT * FROM users WHERE email = ?", (clean_email,))
        if not user_row or not verify_password(password, user_row["password_hash"]):
            raise ValueError("Incorrect email or password.")

        now = utc_now_iso()
        token = generate_session_token()
        expires_at = get_session_expiry_iso(14)
        conn.execute(
            """
            INSERT INTO sessions (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_row["id"], now, expires_at),
        )

    return _strip_sensitive_user_fields(user_row), token


def logout_session(token: str) -> None:
    if not token:
        return
    clean_token = token.replace("Bearer ", "").strip()
    if not clean_token:
        return
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (clean_token,))


def get_user_by_session_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    clean_token = token.replace("Bearer ", "").strip()
    if not clean_token:
        return None

    with get_db() as conn:
        session_row = fetch_one(
            conn, "SELECT * FROM sessions WHERE token = ?", (clean_token,)
        )
        if not session_row:
            return None
        try:
            exp = datetime.fromisoformat(session_row["expires_at"])
            if exp < datetime.now(timezone.utc):
                conn.execute("DELETE FROM sessions WHERE token = ?", (clean_token,))
                return None
        except Exception:
            pass

        user_row = fetch_one(
            conn, "SELECT * FROM users WHERE id = ?", (session_row["user_id"],)
        )
        if not user_row:
            return None
        return _strip_sensitive_user_fields(user_row)


def get_founder_profile(user_id: str) -> Dict[str, Any]:
    with get_db() as conn:
        prof = fetch_one(
            conn, "SELECT * FROM founder_profiles WHERE user_id = ?", (user_id,)
        )
        if prof:
            res = dict(prof)
            res.setdefault("company_name", "")
            return res
        user_row = fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,))
        if not user_row:
            raise ValueError("User not found.")
        now = utc_now_iso()
        profile_id = new_id("prf")
        conn.execute(
            """
            INSERT INTO founder_profiles (
                id, user_id, full_name, company_name, phone, city, state,
                preferred_sourcing_location, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                user_id,
                user_row["full_name"],
                user_row.get("company_name", ""),
                user_row["phone"],
                user_row["city"],
                user_row["state"],
                f"{user_row['city']}, {user_row['state']}",
                now,
                now,
            ),
        )
        prof = fetch_one(
            conn, "SELECT * FROM founder_profiles WHERE user_id = ?", (user_id,)
        )
        res = dict(prof)
        res.setdefault("company_name", "")
        return res


def update_founder_profile(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    current = get_founder_profile(user_id)
    now = utc_now_iso()

    full_name = str(payload.get("full_name", current["full_name"]) or current["full_name"]).strip()
    company_name = str(payload.get("company_name", current.get("company_name", "")) or "").strip()
    phone = str(payload.get("phone", current["phone"]) or "").strip()
    city = str(payload.get("city", current["city"]) or "Bengaluru").strip()
    state = str(payload.get("state", current["state"]) or "Karnataka").strip()
    business_experience = str(payload.get("business_experience", current["business_experience"]) or "").strip()
    skills = str(payload.get("skills", current["skills"]) or "").strip()
    industry_interests = str(payload.get("industry_interests", current["industry_interests"]) or "").strip()
    available_capital = float(payload.get("available_capital", current["available_capital"]) or 0.0)
    preferred_product_categories = str(
        payload.get("preferred_product_categories", current["preferred_product_categories"]) or ""
    ).strip()
    available_time = str(payload.get("available_time", current["available_time"]) or "").strip()
    preferred_sourcing_location = str(
        payload.get("preferred_sourcing_location", current["preferred_sourcing_location"])
        or f"{city}, {state}"
    ).strip()

    with get_db() as conn:
        conn.execute(
            """
            UPDATE founder_profiles SET
                full_name = ?,
                company_name = ?,
                phone = ?,
                city = ?,
                state = ?,
                business_experience = ?,
                skills = ?,
                industry_interests = ?,
                available_capital = ?,
                preferred_product_categories = ?,
                available_time = ?,
                preferred_sourcing_location = ?,
                updated_at = ?
            WHERE user_id = ?
            """,
            (
                full_name,
                company_name,
                phone,
                city,
                state,
                business_experience,
                skills,
                industry_interests,
                available_capital,
                preferred_product_categories,
                available_time,
                preferred_sourcing_location,
                now,
                user_id,
            ),
        )
        conn.execute(
            """
            UPDATE users SET
                full_name = ?, company_name = ?, phone = ?, city = ?, state = ?, updated_at = ?
            WHERE id = ?
            """,
            (full_name, company_name, phone, city, state, now, user_id),
        )
        updated = fetch_one(
            conn, "SELECT * FROM founder_profiles WHERE user_id = ?", (user_id,)
        )
    res = dict(updated)
    res.setdefault("company_name", "")
    return res
