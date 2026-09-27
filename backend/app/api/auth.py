"""
Authentication API Handlers (backend/app/api/auth.py)
"""
from typing import Any, Dict, Optional, Tuple
from app.services.auth_service import (
    authenticate_user,
    get_user_by_session_token,
    logout_session,
    register_user,
)


def handle_signup(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    try:
        user, token = register_user(
            full_name=payload.get("full_name", ""),
            email=payload.get("email", ""),
            password=payload.get("password", ""),
            phone=payload.get("phone", ""),
            city=payload.get("city", "Bengaluru"),
            state=payload.get("state", "Karnataka"),
            company_name=payload.get("company_name", ""),
        )
        return 201, {"user": user, "token": token}
    except ValueError as exc:
        msg = str(exc)
        return 400, {"error": msg, "detail": msg}


def handle_login(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    try:
        user, token = authenticate_user(
            email=payload.get("email", ""),
            password=payload.get("password", ""),
        )
        return 200, {"user": user, "token": token}
    except ValueError as exc:
        msg = str(exc)
        return 401, {"error": msg, "detail": msg}


def handle_logout(token: Optional[str]) -> Tuple[int, Dict[str, Any]]:
    if token:
        logout_session(token.replace("Bearer ", "").strip())
    return 200, {"status": "logged_out"}


def handle_me(token: Optional[str]) -> Tuple[int, Dict[str, Any]]:
    user = get_user_by_session_token(token)
    if not user:
        msg = "Please sign in to continue."
        return 401, {"error": msg, "detail": msg}
    return 200, {"user": user}
