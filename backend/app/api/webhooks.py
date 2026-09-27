"""
n8n & External Webhooks API Handlers (backend/app/api/webhooks.py)
Implements Section 30:
- POST /api/webhooks/supplier-response
- POST /api/webhooks/approval
- POST /api/webhooks/external-event
Validates N8N_WEBHOOK_SECRET or authenticated user ownership.
n8n never overrides Policy Engine or becomes the mission database.
"""
from typing import Any, Dict, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.security import verify_webhook_signature
from backend.app.database.session import fetch_one, get_db
from backend.app.services.approval_service import approve_request, reject_request
from backend.app.services.mission_service import (
    run_mission_process_supplier_response,
    run_mission_supplier_delay_recovery,
)


def _authorize_webhook_or_user(
    user: Optional[Dict[str, Any]],
    provided_secret: Optional[str],
    mission_id: str,
) -> Optional[str]:
    """
    Returns the authoritative user_id for the mission if authorized via either:
    1) Authenticated session owning the mission, OR
    2) Valid N8N_WEBHOOK_SECRET header when N8N_WEBHOOK_SECRET is configured.
    """
    with get_db() as conn:
        m = fetch_one(conn, "SELECT user_id FROM missions WHERE id = ?", (mission_id,))
    if not m:
        return None

    if user and user["id"] == m["user_id"]:
        return m["user_id"]

    if settings.N8N_WEBHOOK_SECRET and verify_webhook_signature(
        settings.N8N_WEBHOOK_SECRET, provided_secret
    ):
        return m["user_id"]

    return None


def handle_webhook_supplier_response(
    user: Optional[Dict[str, Any]],
    provided_secret: Optional[str],
    payload: Dict[str, Any],
) -> Tuple[int, Dict[str, Any]]:
    mission_id = str(payload.get("mission_id") or "")
    if not mission_id:
        return 400, {"error": "mission_id is required."}

    owner_id = _authorize_webhook_or_user(user, provided_secret, mission_id)
    if not owner_id:
        return 403, {"error": "Unauthorized webhook or mission ownership mismatch."}

    try:
        mission = run_mission_process_supplier_response(
            mission_id=mission_id, user_id=owner_id, payload=payload
        )
        return 200, {"status": "processed", "mission": mission}
    except ValueError as exc:
        return 400, {"error": str(exc)}


def handle_webhook_external_event(
    user: Optional[Dict[str, Any]],
    provided_secret: Optional[str],
    payload: Dict[str, Any],
) -> Tuple[int, Dict[str, Any]]:
    """
    Handles external disruption payloads such as:
    {
      "mission_id": "...",
      "supplier_id": "...",
      "event_type": "DELIVERY_DELAY",
      "message": "Delivery will now take 42 days.",
      "received_at": "..."
    }
    """
    mission_id = str(payload.get("mission_id") or "")
    if not mission_id:
        return 400, {"error": "mission_id is required."}

    owner_id = _authorize_webhook_or_user(user, provided_secret, mission_id)
    if not owner_id:
        return 403, {"error": "Unauthorized webhook or mission ownership mismatch."}

    import re
    msg = str(payload.get("message") or "")
    lead_time = payload.get("lead_time_days")
    if lead_time is None and msg:
        m = re.search(r"(\d+)\s*days?", msg, re.I)
        if m:
            lead_time = int(m.group(1))
    if lead_time is None:
        lead_time = 42

    try:
        mission = run_mission_supplier_delay_recovery(
            mission_id=mission_id,
            user_id=owner_id,
            payload={
                "supplier_id": payload.get("supplier_id"),
                "event_type": payload.get("event_type", "DELIVERY_DELAY"),
                "lead_time_days": int(lead_time),
                "message": msg or f"Delivery will now take {lead_time} days.",
            },
        )
        return 200, {"status": "recovery_triggered", "mission": mission}
    except ValueError as exc:
        return 400, {"error": str(exc)}


def handle_webhook_approval(
    user: Optional[Dict[str, Any]],
    provided_secret: Optional[str],
    payload: Dict[str, Any],
) -> Tuple[int, Dict[str, Any]]:
    approval_id = str(payload.get("approval_id") or "")
    decision = str(payload.get("decision") or "APPROVE").upper()
    if not approval_id:
        return 400, {"error": "approval_id is required."}

    with get_db() as conn:
        apr = fetch_one(conn, "SELECT * FROM approvals WHERE id = ?", (approval_id,))
    if not apr:
        return 404, {"error": "Approval not found."}

    owner_id = _authorize_webhook_or_user(user, provided_secret, apr["mission_id"])
    if not owner_id:
        return 403, {"error": "Unauthorized webhook or approval ownership mismatch."}

    try:
        if decision == "APPROVE":
            res = approve_request(
                approval_id=approval_id,
                user_id=owner_id,
                decision_notes=str(payload.get("decision_notes") or "Approved via webhook."),
            )
        else:
            res = reject_request(
                approval_id=approval_id,
                user_id=owner_id,
                decision_notes=str(payload.get("decision_notes") or "Rejected via webhook."),
            )
        return 200, {"status": "updated", "approval": res}
    except ValueError as exc:
        return 400, {"error": str(exc)}
