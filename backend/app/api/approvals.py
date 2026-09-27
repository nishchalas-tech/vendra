"""
Approvals API Handlers (backend/app/api/approvals.py)
"""
from typing import Any, Dict, Optional, Tuple
from app.services.approval_service import (
    approve_request,
    list_user_approvals,
    reject_request,
)


def handle_list_approvals(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    approvals = list_user_approvals(user_id=user["id"], mission_id=mission_id)
    return 200, {"approvals": approvals}


def handle_approve(
    user: Dict[str, Any], approval_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        notes = str(
            payload.get("decision_notes") or "Approved by founder for procurement execution."
        )
        updated = approve_request(
            approval_id=approval_id, user_id=user["id"], decision_notes=notes
        )
        return 200, {"approval": updated}
    except ValueError as exc:
        return 400, {"error": str(exc)}


def handle_reject(
    user: Dict[str, Any], approval_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        notes = str(
            payload.get("decision_notes") or "Rejected by founder; continue recovery evaluation."
        )
        updated = reject_request(
            approval_id=approval_id, user_id=user["id"], decision_notes=notes
        )
        return 200, {"approval": updated}
    except ValueError as exc:
        return 400, {"error": str(exc)}
