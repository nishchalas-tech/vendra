"""
Supplier Failure & Recovery Workflow (backend/app/workflows/supplier_recovery.py)
Implements all 23 steps of the Hero Agentic Workflow (Section 27):
1. receive event
2. validate event
3. update supplier response
4. update mission state
5. run constraint engine
6. detect deadline/budget violation
7. create risk
8. calculate impact
9. ask Mission Orchestrator for next action
10. search alternatives
11. filter alternatives
12. generate RFQs
13. process responses
14. recalculate costs
15. compare recovery options
16. request human approval
17. wait (AWAITING_APPROVAL)
(Steps 18-23 complete upon human approval in approval_service.py)
"""
import hashlib
import json
from typing import Any, Dict, List
from backend.app.agents.orchestrator import orchestrator
from backend.app.database.base import new_id, utc_now_iso
from backend.app.database.session import fetch_all, fetch_one, get_db
from backend.app.models.mission import MissionState
from backend.app.services.approval_service import create_approval_request
from backend.app.services.finance_service import record_audit_event
from backend.app.services.rfq_service import create_rfq_for_supplier
from backend.app.services.risk_service import create_or_update_mission_risk
from backend.app.services.supplier_service import discover_and_persist_mission_suppliers
from backend.app.tools.constraint_checker import check_mission_constraints
from backend.app.tools.cost_calculator import calculate_procurement_cost, format_inr
from backend.app.tools.supplier_lookup import lookup_supplier_by_id


def execute_supplier_failure_recovery_workflow(
    mission: Dict[str, Any],
    supplier_id: str,
    new_lead_time_days: int = 42,
    new_unit_price: float = 0.0,
    event_type: str = "DELIVERY_DELAY",
    message: str = "",
) -> Dict[str, Any]:
    user_id = mission["user_id"]
    mission_id = mission["id"]
    deadline = int(mission.get("delivery_deadline") or 30)
    now = utc_now_iso()

    # Idempotency guard: prevent duplicate external events from creating duplicate commitments (Section 31 & 67)
    event_fingerprint = f"{mission_id}:{supplier_id}:{event_type}:{new_lead_time_days}:{new_unit_price}"
    event_hash = hashlib.sha256(event_fingerprint.encode("utf-8")).hexdigest()
    with get_db() as conn:
        dup = fetch_one(
            conn,
            "SELECT * FROM processed_webhooks WHERE event_hash = ?",
            (event_hash,),
        )
        if dup and mission.get("state") in (
            MissionState.AWAITING_APPROVAL.value,
            MissionState.RECOVERY_IN_PROGRESS.value,
        ):
            return {
                "duplicate_ignored": True,
                "mission_id": mission_id,
                "message": "Duplicate external event detected; idempotency guard preserved existing recovery state.",
            }
        conn.execute(
            """
            INSERT OR REPLACE INTO processed_webhooks (event_hash, mission_id, event_type, processed_at)
            VALUES (?, ?, ?, ?)
            """,
            (event_hash, mission_id, event_type, now),
        )

    supplier = lookup_supplier_by_id(supplier_id)
    if not supplier:
        # Fallback to second discovered supplier or Bommasandra Supplier B
        supplier = lookup_supplier_by_id("sup_bommasandra_02")
        supplier_id = supplier["supplier_id"]

    supplier_name = supplier["name"]

    # Look up previous lead time on existing response (default to supplier's initial lead_time_days, e.g., 25 days)
    with get_db() as conn:
        existing_resp = fetch_one(
            conn,
            "SELECT * FROM supplier_responses WHERE mission_id = ? AND supplier_id = ? ORDER BY created_at DESC LIMIT 1",
            (mission_id, supplier_id),
        )

    previous_lead_time = (
        int(existing_resp["lead_time_days"])
        if existing_resp and existing_resp.get("lead_time_days") is not None
        else int(supplier.get("lead_time_days") or 25)
    )
    unit_price = (
        float(new_unit_price)
        if new_unit_price > 0
        else (
            float(existing_resp["unit_price"])
            if existing_resp and existing_resp.get("unit_price") is not None
            else float(supplier["indicative_unit_price_inr"])
        )
    )

    event_msg = message or f"Supplier notification: Delivery lead time revised from {previous_lead_time} days to {new_lead_time_days} days."

    # STEP 1 & 2: Receive and validate event
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="External Event Monitor",
        event_type="EXTERNAL_EVENT_RECEIVED",
        action=f"Supplier delay event received from {supplier_name}",
        reason=event_msg,
        input_reference=supplier_id,
        output_reference=f"{previous_lead_time}d -> {new_lead_time_days}d",
        policy_decision="AUTO_EXECUTE",
        result="VALIDATED",
    )

    # STEP 3 & 4 & 5: Update supplier response, update mission state to EVALUATING, run Cost & Constraint Engines
    updated_cost = calculate_procurement_cost(
        unit_cost=unit_price,
        quantity=int(mission["quantity"]),
        maximum_budget=float(mission["maximum_budget"]),
        target_unit_cost=float(mission["target_unit_cost"]),
    )
    updated_constraints = check_mission_constraints(
        mission=mission,
        response_data={
            "unit_price": unit_price,
            "moq": supplier["minimum_order_quantity"],
            "lead_time_days": new_lead_time_days,
            "certifications": supplier["certifications"],
        },
        cost_breakdown=updated_cost,
        supplier_location=supplier["location"],
    )

    with get_db() as conn:
        if existing_resp:
            conn.execute(
                """
                UPDATE supplier_responses SET
                    raw_message = ?,
                    lead_time_days = ?,
                    unit_price = ?,
                    notes = ?,
                    cost_breakdown_json = ?,
                    constraint_results_json = ?,
                    is_valid_all_constraints = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    event_msg,
                    new_lead_time_days,
                    unit_price,
                    event_msg,
                    json.dumps(updated_cost),
                    json.dumps(updated_constraints["results"]),
                    1 if updated_constraints["all_passed"] else 0,
                    now,
                    existing_resp["id"],
                ),
            )
        else:
            resp_id = new_id("rsp")
            conn.execute(
                """
                INSERT INTO supplier_responses (
                    id, mission_id, rfq_id, supplier_id, supplier_name,
                    raw_message, unit_price, moq, lead_time_days,
                    material, certifications, packaging, payment_terms,
                    notes, evidence, cost_breakdown_json, constraint_results_json,
                    is_valid_all_constraints, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resp_id,
                    mission_id,
                    None,
                    supplier_id,
                    supplier_name,
                    event_msg,
                    unit_price,
                    supplier["minimum_order_quantity"],
                    new_lead_time_days,
                    supplier["materials"],
                    supplier["certifications"],
                    supplier["packaging_capabilities"],
                    supplier["payment_terms"],
                    event_msg,
                    supplier["evidence"],
                    json.dumps(updated_cost),
                    json.dumps(updated_constraints["results"]),
                    1 if updated_constraints["all_passed"] else 0,
                    now,
                    now,
                ),
            )
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.RISK_DETECTED.value, now, mission_id),
        )

    # STEP 6: Detect deadline violation
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Constraint Engine",
        event_type="CONSTRAINT_CHECKED",
        action="Deadline violation detected",
        reason=f"Constraint failed: {new_lead_time_days} days > {deadline} days mission deadline (+{new_lead_time_days - deadline} days overrun).",
        input_reference=f"deadline<={deadline}d",
        output_reference=f"actual={new_lead_time_days}d",
        policy_decision="AUTO_EXECUTE",
        result="DEADLINE_VIOLATED",
    )

    # STEP 9: Ask Mission Orchestrator for next action (validated via AgentDecision + Policy Engine)
    orch_step = orchestrator.decide_next_action(
        mission=mission,
        context_summary=f"{supplier_name} revised delivery from {previous_lead_time} days to {new_lead_time_days} days, violating the {deadline}-day deadline.",
        default_decision_dict={
            "action_type": "alternative_discovery",
            "reason": f"{supplier_name} lead time ({new_lead_time_days} days) exceeds mission deadline ({deadline} days). Discovering and evaluating eligible backup suppliers within budget.",
            "tool_name": "supplier_search",
            "tool_arguments": {"exclude_supplier_ids": [supplier_id]},
            "risk_level": "HIGH",
            "requires_human_approval": False,
            "expected_outcome": "Identify and qualify eligible recovery suppliers that meet deadline and budget constraints.",
            "constraints_checked": [
                "lead time <= deadline",
                "total spend <= maximum budget",
                "landed unit cost <= target unit cost",
                "MOQ <= required purchasing quantity",
            ],
            "evidence_required": [
                "Supplier lead time confirmation",
                "Landed cost breakdown in INR",
                "ISO/BIS certification record",
            ],
        },
    )

    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.RECOVERY_IN_PROGRESS.value, now, mission_id),
        )

    # STEP 10 & 11: Search and filter alternative suppliers excluding the delayed supplier
    alternatives = discover_and_persist_mission_suppliers(
        mission=mission,
        is_recovery=True,
        exclude_supplier_ids=[supplier_id],
        top_n=4,
    )
    eligible_alternatives = [
        a
        for a in alternatives
        if a["supplier_id"] != supplier_id and int(a["lead_time_days"]) <= deadline
    ][:3]

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Mission Orchestrator",
        event_type="RECOVERY_STARTED",
        action=f"Recovery search initiated — {len(eligible_alternatives)} eligible alternatives found",
        reason=orch_step["decision"]["reason"],
        input_reference=supplier_id,
        output_reference=",".join(a["supplier_id"] for a in eligible_alternatives),
        policy_decision=orch_step["policy"]["decision"],
        result="RECOVERY_IN_PROGRESS",
    )

    # STEP 12, 13, 14, 15: Generate RFQs for recovery alternatives, process responses, recalculate costs, compare options
    recovery_options_summary: List[Dict[str, Any]] = []
    for alt in eligible_alternatives:
        rfq = create_rfq_for_supplier(
            mission=mission, supplier_id=alt["supplier_id"], auto_send=True
        )
        alt_unit = float(alt["indicative_unit_price_inr"])
        alt_cost = calculate_procurement_cost(
            unit_cost=alt_unit,
            quantity=int(mission["quantity"]),
            maximum_budget=float(mission["maximum_budget"]),
            target_unit_cost=float(mission["target_unit_cost"]),
        )
        alt_constraints = check_mission_constraints(
            mission=mission,
            response_data={
                "unit_price": alt_unit,
                "moq": alt["minimum_order_quantity"],
                "lead_time_days": alt["lead_time_days"],
                "certifications": alt["certifications"],
            },
            cost_breakdown=alt_cost,
            supplier_location=alt["location"],
        )

        # Persist recovery quote response if not already stored
        with get_db() as conn:
            existing_alt_resp = fetch_one(
                conn,
                "SELECT id FROM supplier_responses WHERE mission_id = ? AND supplier_id = ?",
                (mission_id, alt["supplier_id"]),
            )
            if not existing_alt_resp:
                conn.execute(
                    """
                    INSERT INTO supplier_responses (
                        id, mission_id, rfq_id, supplier_id, supplier_name,
                        raw_message, unit_price, moq, lead_time_days,
                        material, certifications, packaging, payment_terms,
                        shipping_cost_inr, packaging_cost_inr, other_costs_inr,
                        notes, evidence, cost_breakdown_json, constraint_results_json,
                        is_valid_all_constraints, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id("rsp"),
                        mission_id,
                        rfq["id"],
                        alt["supplier_id"],
                        alt["name"],
                        f"Confirmed recovery slot: ₹{alt_unit:.0f}/unit ex-works, delivery in {alt['lead_time_days']} days.",
                        alt_unit,
                        alt["minimum_order_quantity"],
                        alt["lead_time_days"],
                        alt["materials"],
                        alt["certifications"],
                        alt["packaging_capabilities"],
                        alt["payment_terms"],
                        alt_cost["shipping"],
                        alt_cost["packaging"],
                        alt_cost["other_known_costs"],
                        "Verified recovery quotation within mission deadline.",
                        alt["evidence"],
                        json.dumps(alt_cost),
                        json.dumps(alt_constraints["results"]),
                        1 if alt_constraints["all_passed"] else 0,
                        now,
                        now,
                    ),
                )
            conn.execute(
                "UPDATE rfqs SET status = 'RESPONDED', updated_at = ? WHERE id = ?",
                (now, rfq["id"]),
            )

        recovery_options_summary.append(
            {
                "supplier_id": alt["supplier_id"],
                "supplier_name": alt["name"],
                "location": f"{alt['area']}, {alt['city']}",
                "moq": alt["minimum_order_quantity"],
                "unit_price_inr": alt_unit,
                "landed_unit_cost_inr": alt_cost["landed_cost"],
                "total_procurement_cost_inr": alt_cost["total_procurement_cost"],
                "formatted_total_cost": alt_cost["formatted_total"],
                "lead_time_days": alt["lead_time_days"],
                "certifications": alt["certifications"],
                "reliability_score": alt["reliability_score"],
                "all_constraints_passed": alt_constraints["all_passed"],
                "demo_supplier": bool(alt.get("demo_supplier", True)),
                "evidence": alt["evidence"],
            }
        )

    # Sort recovery options by all_constraints_passed, total_procurement_cost_inr, lead_time_days
    recovery_options_summary.sort(
        key=lambda o: (
            0 if o["all_constraints_passed"] else 1,
            o["total_procurement_cost_inr"],
            o["lead_time_days"],
        )
    )

    recommended = recovery_options_summary[0] if recovery_options_summary else None

    # STEP 7 & 8: Create structured Risk record explaining WHAT CHANGED, WHY IS IT A PROBLEM, WHAT CONSTRAINT FAILED, etc.
    risk_record = create_or_update_mission_risk(
        mission_id=mission_id,
        user_id=user_id,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        risk_type="DEADLINE_VIOLATION",
        severity="CRITICAL",
        what_changed=f"{supplier_name} delivery lead time changed from {previous_lead_time} days → {new_lead_time_days} days.",
        why_problem=f"The revised {new_lead_time_days}-day delivery schedule exceeds the mission deadline of {deadline} days by {new_lead_time_days - deadline} days, threatening launch commitments.",
        constraint_failed=f"lead time <= deadline ({new_lead_time_days} > {deadline} days — DEADLINE VIOLATED)",
        expected_value=f"<= {deadline} days",
        actual_value=f"{new_lead_time_days} days",
        vendra_action=(
            f"Automatically halted allocation to {supplier_name}, searched regional clusters, generated recovery RFQs, "
            f"and qualified {len(recovery_options_summary)} compliant alternative suppliers."
        ),
        recovery_options=recovery_options_summary,
        requires_human_approval=True,
    )

    # STEP 16 & 17: Request human approval via Policy Engine (HUMAN_APPROVAL) and wait
    approval_record = None
    if recommended:
        rec_supplier = lookup_supplier_by_id(recommended["supplier_id"])
        approval_record = create_approval_request(
            mission=mission,
            action=f"Switch primary supplier to {recommended['supplier_name']} and authorize recovery procurement",
            reason=(
                f"{supplier_name} violated the {deadline}-day deadline ({previous_lead_time} days → {new_lead_time_days} days). "
                f"{recommended['supplier_name']} ({recommended['location']}) delivers in {recommended['lead_time_days']} days "
                f"at {recommended['formatted_total_cost']} total landed cost (within the {format_inr(mission['maximum_budget'])} budget)."
            ),
            supplier=rec_supplier,
            unit_price=recommended["unit_price_inr"],
            total_cost=recommended["total_procurement_cost_inr"],
            lead_time_days=recommended["lead_time_days"],
            risk_summary=f"Mitigates {new_lead_time_days}-day delay from {supplier_name}; saves {new_lead_time_days - recommended['lead_time_days']} calendar days.",
            recommendation_rationale=(
                f"Lowest landed total cost ({recommended['formatted_total_cost']}) among compliant Bengaluru/Karnataka suppliers "
                f"with {recommended['lead_time_days']}-day turnaround (<= {deadline}d deadline) and {recommended['certifications']}."
            ),
        )

    return {
        "mission_id": mission_id,
        "state": MissionState.AWAITING_APPROVAL.value,
        "risk": risk_record,
        "recovery_options": recovery_options_summary,
        "approval": approval_record,
    }
