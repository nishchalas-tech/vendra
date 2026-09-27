"""
RFQs API Handlers (backend/app/api/rfqs.py)
"""
from typing import Any, Dict, Optional, Tuple
from app.services.mission_service import get_mission_detail
from app.services.rfq_service import (
    create_rfq_for_supplier,
    list_mission_rfqs,
    send_rfq,
    update_rfq,
)


def handle_list_rfqs(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    if mission_id:
        try:
            get_mission_detail(mission_id=mission_id, user_id=user["id"])
        except ValueError as exc:
            return 404, {"error": str(exc)}
    rfqs = list_mission_rfqs(user_id=user["id"], mission_id=mission_id)
    return 200, {"rfqs": rfqs}


def handle_create_rfq(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = get_mission_detail(mission_id=mission_id, user_id=user["id"])
        supplier_id = payload.get("supplier_id")
        if not supplier_id:
            if mission["suppliers"]:
                supplier_id = mission["suppliers"][0]["supplier_id"]
            else:
                return 400, {"error": "supplier_id is required."}
        rfq = create_rfq_for_supplier(
            mission=mission,
            supplier_id=supplier_id,
            auto_send=bool(payload.get("auto_send", False)),
        )
        return 201, {"rfq": rfq}
    except ValueError as exc:
        return 400, {"error": str(exc)}


def handle_send_rfq(user: Dict[str, Any], rfq_id: str) -> Tuple[int, Dict[str, Any]]:
    try:
        rfq = send_rfq(rfq_id=rfq_id, user_id=user["id"])
        return 200, {"rfq": rfq}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_update_rfq(
    user: Dict[str, Any], rfq_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        rfq = update_rfq(rfq_id=rfq_id, user_id=user["id"], payload=payload)
        return 200, {"rfq": rfq}
    except ValueError as exc:
        return 404, {"error": str(exc)}
