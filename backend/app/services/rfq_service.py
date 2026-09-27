"""
RFQ Service (backend/app/services/rfq_service.py)
Implements Section 23:
Creates, stores, sends, and updates RFQs for mission-qualified suppliers.
"""
from typing import Any, Dict, List, Optional
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, fetch_one, get_db
from app.models.rfq import RFQStatus
from app.services.finance_service import record_audit_event
from app.tools.rfq_generator import generate_rfq_document
from app.tools.supplier_lookup import lookup_supplier_by_id


def create_rfq_for_supplier(
    mission: Dict[str, Any],
    supplier_id: str,
    auto_send: bool = False,
) -> Dict[str, Any]:
    supplier = lookup_supplier_by_id(supplier_id)
    if not supplier:
        raise ValueError(f"Supplier '{supplier_id}' not found.")

    with get_db() as conn:
        existing = fetch_one(
            conn,
            "SELECT * FROM rfqs WHERE mission_id = ? AND supplier_id = ?",
            (mission["id"], supplier_id),
        )
        if existing:
            if auto_send and existing["status"] in ("DRAFT", "READY"):
                return send_rfq(existing["id"], mission["user_id"])
            return dict(existing)

    rfq_doc = generate_rfq_document(mission=mission, supplier=supplier)
    rfq_id = new_id("rfq")
    now = utc_now_iso()
    status = RFQStatus.SENT.value if auto_send else RFQStatus.READY.value
    sent_at = now if auto_send else None

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO rfqs (
                id, mission_id, user_id, supplier_id, supplier_name, status,
                product_requirements, quantity, material, quality, packaging,
                certification, delivery_deadline, pricing_request,
                moq_request, lead_time_request, payment_terms,
                shipping_requirements, rfq_body, sent_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rfq_id,
                mission["id"],
                mission["user_id"],
                supplier_id,
                supplier["name"],
                status,
                rfq_doc["product_requirements"],
                rfq_doc["quantity"],
                rfq_doc["material"],
                rfq_doc["quality"],
                rfq_doc["packaging"],
                rfq_doc["certification"],
                rfq_doc["delivery_deadline"],
                rfq_doc["pricing_request"],
                rfq_doc["moq_request"],
                rfq_doc["lead_time_request"],
                rfq_doc["payment_terms"],
                rfq_doc["shipping_requirements"],
                rfq_doc["rfq_body"],
                sent_at,
                now,
                now,
            ),
        )
        row = fetch_one(conn, "SELECT * FROM rfqs WHERE id = ?", (rfq_id,))

    record_audit_event(
        user_id=mission["user_id"],
        mission_id=mission["id"],
        actor="Mission Orchestrator",
        event_type="RFQ_GENERATED",
        action=f"RFQ generated for {supplier['name']}",
        reason=f"Drafted formal RFQ for {mission['quantity']} units of {mission['product_name']}.",
        input_reference=supplier_id,
        output_reference=rfq_id,
        policy_decision="AUTO_EXECUTE",
        result=status,
    )

    if auto_send:
        record_audit_event(
            user_id=mission["user_id"],
            mission_id=mission["id"],
            actor="Mission Orchestrator",
            event_type="RFQ_SENT",
            action=f"RFQ dispatched to {supplier['name']}",
            reason="RFQ transmitted; awaiting supplier quotation response.",
            input_reference=rfq_id,
            output_reference=supplier_id,
            policy_decision="AUTO_EXECUTE",
            result="SENT",
        )

    return dict(row)


def send_rfq(rfq_id: str, user_id: str) -> Dict[str, Any]:
    now = utc_now_iso()
    with get_db() as conn:
        rfq = fetch_one(
            conn, "SELECT * FROM rfqs WHERE id = ? AND user_id = ?", (rfq_id, user_id)
        )
        if not rfq:
            raise ValueError("RFQ not found or access denied.")
        conn.execute(
            "UPDATE rfqs SET status = ?, sent_at = ?, updated_at = ? WHERE id = ?",
            (RFQStatus.SENT.value, now, now, rfq_id),
        )
        conn.execute(
            """
            UPDATE missions SET state = CASE
                WHEN state IN ('DRAFT', 'READY', 'SUPPLIER_DISCOVERY', 'RFQ_PREPARATION')
                THEN 'WAITING_FOR_RESPONSE'
                ELSE state
            END, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (now, rfq["mission_id"], user_id),
        )
        updated = fetch_one(conn, "SELECT * FROM rfqs WHERE id = ?", (rfq_id,))

    record_audit_event(
        user_id=user_id,
        mission_id=rfq["mission_id"],
        actor="Mission Orchestrator",
        event_type="RFQ_SENT",
        action=f"RFQ sent to {rfq['supplier_name']}",
        reason="RFQ dispatched to supplier; mission transitioned to WAITING_FOR_RESPONSE.",
        input_reference=rfq_id,
        output_reference=rfq["supplier_id"],
        policy_decision="AUTO_EXECUTE",
        result="SENT",
    )
    return dict(updated)


def list_mission_rfqs(user_id: str, mission_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if mission_id:
            rows = fetch_all(
                conn,
                "SELECT * FROM rfqs WHERE user_id = ? AND mission_id = ? ORDER BY created_at ASC",
                (user_id, mission_id),
            )
        else:
            rows = fetch_all(
                conn,
                "SELECT * FROM rfqs WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
    return [dict(r) for r in rows]


def update_rfq(rfq_id: str, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    now = utc_now_iso()
    with get_db() as conn:
        rfq = fetch_one(
            conn, "SELECT * FROM rfqs WHERE id = ? AND user_id = ?", (rfq_id, user_id)
        )
        if not rfq:
            raise ValueError("RFQ not found or access denied.")

        prod_req = str(payload.get("product_requirements") or rfq["product_requirements"]).strip()
        qty = int(payload.get("quantity") or rfq["quantity"])
        mat = str(payload.get("material") or rfq["material"]).strip()
        deadline = int(payload.get("delivery_deadline") or rfq["delivery_deadline"])
        pricing_req = str(payload.get("pricing_request") or rfq["pricing_request"]).strip()
        pay_terms = str(payload.get("payment_terms") or rfq["payment_terms"]).strip()
        rfq_body = str(payload.get("rfq_body") or rfq["rfq_body"]).strip()

        conn.execute(
            """
            UPDATE rfqs SET
                product_requirements = ?,
                quantity = ?,
                material = ?,
                delivery_deadline = ?,
                pricing_request = ?,
                payment_terms = ?,
                rfq_body = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                prod_req,
                qty,
                mat,
                deadline,
                pricing_req,
                pay_terms,
                rfq_body,
                now,
                rfq_id,
                user_id,
            ),
        )
        updated = fetch_one(conn, "SELECT * FROM rfqs WHERE id = ?", (rfq_id,))

    record_audit_event(
        user_id=user_id,
        mission_id=rfq["mission_id"],
        actor="Founder / Procurement Operator",
        event_type="RFQ_UPDATED",
        action=f"RFQ updated for {rfq['supplier_name']}",
        reason="Updated commercial RFQ specifications prior to dispatch.",
        input_reference=rfq_id,
        output_reference=rfq["supplier_id"],
        policy_decision="HUMAN_EDIT",
        result=updated["status"],
    )
    return dict(updated)
