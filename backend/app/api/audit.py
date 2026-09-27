"""
Audit Ledger API Handlers (backend/app/api/audit.py)
"""
from typing import Any, Dict, Optional, Tuple
from app.services.finance_service import list_mission_audit_events
from app.services.mission_service import get_mission_detail


def handle_list_audit_events(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    if mission_id:
        try:
            get_mission_detail(mission_id=mission_id, user_id=user["id"])
        except ValueError as exc:
            return 404, {"error": str(exc)}
    events = list_mission_audit_events(user_id=user["id"], mission_id=mission_id)
    return 200, {"audit_events": events}
