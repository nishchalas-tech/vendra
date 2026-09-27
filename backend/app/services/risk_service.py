"""
Risk Service (backend/app/services/risk_service.py)
Implements Section 27 & Section 42:
Records constraint violations and explains:
WHAT CHANGED? WHY IS IT A PROBLEM? WHAT CONSTRAINT FAILED?
WHAT DID VENDRA DO? WHAT OPTIONS EXIST? WHAT NEEDS HUMAN APPROVAL?
"""
import json
from typing import Any, Dict, List, Optional
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, fetch_one, get_db


def create_or_update_mission_risk(
    mission_id: str,
    user_id: str,
    supplier_id: Optional[str],
    supplier_name: str,
    risk_type: str,
    severity: str,
    what_changed: str,
    why_problem: str,
    constraint_failed: str,
    expected_value: str,
    actual_value: str,
    vendra_action: str,
    recovery_options: List[Dict[str, Any]],
    requires_human_approval: bool = True,
) -> Dict[str, Any]:
    now = utc_now_iso()
    risk_id = new_id("rsk")
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO risks (
                id, mission_id, user_id, supplier_id, supplier_name,
                risk_type, severity, status, what_changed, why_problem,
                constraint_failed, expected_value, actual_value,
                vendra_action, recovery_options_json, requires_human_approval,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                risk_id,
                mission_id,
                user_id,
                supplier_id,
                supplier_name,
                risk_type,
                severity,
                "OPEN",
                what_changed,
                why_problem,
                constraint_failed,
                expected_value,
                actual_value,
                vendra_action,
                json.dumps(recovery_options),
                1 if requires_human_approval else 0,
                now,
                now,
            ),
        )
        row = fetch_one(conn, "SELECT * FROM risks WHERE id = ?", (risk_id,))

    return _hydrate_risk(row)


def _hydrate_risk(row: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(row)
    d["requires_human_approval"] = bool(d.get("requires_human_approval", 1))
    try:
        d["recovery_options"] = json.loads(d.get("recovery_options_json") or "[]")
    except Exception:
        d["recovery_options"] = []
    return d


def list_mission_risks(user_id: str, mission_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if mission_id:
            rows = fetch_all(
                conn,
                "SELECT * FROM risks WHERE user_id = ? AND mission_id = ? ORDER BY created_at DESC",
                (user_id, mission_id),
            )
        else:
            rows = fetch_all(
                conn,
                "SELECT * FROM risks WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
    return [_hydrate_risk(r) for r in rows]
