"""
Audit Event Service & Finance Service (backend/app/services/finance_service.py)
Provides deterministic financial helpers and persistent Audit Ledger recording (Section 29).
"""
from typing import Any, Dict, List, Optional
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, get_db
from app.tools.cost_calculator import calculate_procurement_cost, format_inr


def record_audit_event(
    user_id: str,
    mission_id: Optional[str],
    actor: str,
    event_type: str,
    action: str,
    reason: str,
    input_reference: str = "",
    output_reference: str = "",
    policy_decision: str = "AUTO_EXECUTE",
    result: str = "SUCCESS",
) -> Dict[str, Any]:
    event_id = new_id("aud")
    now = utc_now_iso()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO audit_events (
                id, mission_id, user_id, timestamp, actor, event_type,
                action, reason, input_reference, output_reference,
                policy_decision, result
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                mission_id,
                user_id,
                now,
                actor,
                event_type,
                action,
                reason,
                input_reference,
                output_reference,
                policy_decision,
                result,
            ),
        )
    return {
        "id": event_id,
        "mission_id": mission_id,
        "user_id": user_id,
        "timestamp": now,
        "actor": actor,
        "event_type": event_type,
        "action": action,
        "reason": reason,
        "input_reference": input_reference,
        "output_reference": output_reference,
        "policy_decision": policy_decision,
        "result": result,
    }


def list_mission_audit_events(user_id: str, mission_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if mission_id:
            rows = fetch_all(
                conn,
                "SELECT * FROM audit_events WHERE user_id = ? AND mission_id = ? ORDER BY timestamp ASC",
                (user_id, mission_id),
            )
        else:
            rows = fetch_all(
                conn,
                "SELECT * FROM audit_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 200",
                (user_id,),
            )
    return [dict(r) for r in rows]


__all__ = [
    "calculate_procurement_cost",
    "format_inr",
    "record_audit_event",
    "list_mission_audit_events",
]
