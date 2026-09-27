"""
Founder Profile API Handlers (backend/app/api/profile.py)
"""
from typing import Any, Dict, Tuple
from app.services.auth_service import get_founder_profile, update_founder_profile


def handle_get_profile(user: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    try:
        prof = get_founder_profile(user["id"])
        return 200, {"profile": prof}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_put_profile(user: Dict[str, Any], payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    try:
        prof = update_founder_profile(user["id"], payload)
        return 200, {"profile": prof}
    except ValueError as exc:
        return 400, {"error": str(exc)}
