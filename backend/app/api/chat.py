"""
Vendra AI Chatbot API Handlers (backend/app/api/chat.py)
Exposes endpoints for the Vendra AI Chatbot connected to the real backend services:
- POST /api/chat (and POST /chat)
- GET /api/chat/history (and GET /chat/history)
- POST /api/suppliers/discover (direct live internet supplier discovery endpoint)
"""
from typing import Any, Dict, Optional, Tuple
from backend.app.services.chat_service import (
    list_chat_history,
    process_chat_message,
)
from backend.app.services.supplier_discovery_service import discover_suppliers_live
from backend.app.services.supplier_service import upsert_supplier_record
from backend.app.database.base import utc_now_iso
from backend.app.database.session import get_db


def handle_chat_message(
    user: Dict[str, Any], payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        result = process_chat_message(user=user, payload=payload)
        return 200, result
    except ValueError as exc:
        return 400, {"error": str(exc)}
    except Exception as exc:
        return 500, {"error": str(exc)}


def handle_get_chat_history(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    messages = list_chat_history(user_id=user["id"], mission_id=mission_id)
    return 200, {"messages": messages}


def handle_live_supplier_search(
    user: Dict[str, Any], payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    """
    Direct Live Internet Supplier Discovery endpoint (`POST /api/suppliers/discover`)
    that accepts product, quantity, requirements, focus_requirement, target_budget, location, deadline, certifications
    and returns live web suppliers via `supplier_discovery_service.discover_suppliers_live`.
    """
    try:
        mission_ctx = dict(payload or {})
        if user and user.get("id") and not mission_ctx.get("user_id"):
            mission_ctx["user_id"] = user["id"]

        res = discover_suppliers_live(
            mission=mission_ctx,
            product=payload.get("product") or payload.get("product_name"),
            quantity=int(payload["quantity"]) if payload.get("quantity") else None,
            requirements=payload.get("requirements"),
            focus_requirement=payload.get("focus_requirement") or payload.get("requirement"),
            target_budget=float(payload["target_budget"]) if payload.get("target_budget") else None,
            location=payload.get("location") or payload.get("preferred_sourcing_location"),
            deadline=int(payload["deadline"]) if payload.get("deadline") else None,
            certifications=payload.get("certifications") or payload.get("certification_requirements"),
        )
        now = utc_now_iso()
        with get_db() as conn:
            for sup in res.get("suppliers") or []:
                upsert_supplier_record(conn, sup, now)
        return 200, res
    except Exception as exc:
        return 400, {"error": str(exc)}
