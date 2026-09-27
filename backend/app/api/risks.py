"""
Risks API Handlers (backend/app/api/risks.py)
"""
from typing import Any, Dict, Optional, Tuple
from app.services.mission_service import get_mission_detail
from app.services.risk_service import list_mission_risks


def handle_list_risks(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    if mission_id:
        try:
            get_mission_detail(mission_id=mission_id, user_id=user["id"])
        except ValueError as exc:
            return 404, {"error": str(exc)}
    risks = list_mission_risks(user_id=user["id"], mission_id=mission_id)
    return 200, {"risks": risks}
