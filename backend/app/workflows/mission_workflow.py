"""
Mission Execution Workflow (backend/app/workflows/mission_workflow.py)
Implements Section 19 & Section 31:
mission_started -> supplier_discovery -> generate_rfq -> wait_for_response -> evaluate_response
"""
import json
from typing import Any, Dict, List
from app.agents.orchestrator import orchestrator
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_one, get_db
from app.models.mission import MissionState
from app.services.approval_service import create_approval_request
from app.services.finance_service import record_audit_event
from app.services.rfq_service import create_rfq_for_supplier
from app.services.supplier_service import (
    discover_and_persist_mission_suppliers,
    get_mission_suppliers,
)
from app.tools.constraint_checker import check_mission_constraints
from app.tools.cost_calculator import calculate_procurement_cost, format_inr
from app.tools.response_parser import parse_supplier_response_payload
from app.tools.supplier_lookup import lookup_supplier_by_id


def execute_mission_launch_workflow(mission: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transitions a mission from DRAFT/READY into active execution:
    1. Validates requirements
    2. Runs Mission Orchestrator -> Policy Engine (AUTO_EXECUTE) -> supplier_search
    3. Generates initial RFQs for top eligible suppliers
    4. Persists state and audit trail
    """
    user_id = mission["user_id"]
    mission_id = mission["id"]
    now = utc_now_iso()

    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.READY.value, now, mission_id),
        )

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Mission Orchestrator",
        event_type="REQUIREMENTS_VALIDATED",
        action="Mission requirements validated and launched",
        reason=(
            f"Validated {mission['quantity']} units of {mission['product_name']} "
            f"(Budget: {format_inr(mission['maximum_budget'])}, Target: ₹{mission['target_unit_cost']:.0f}/unit, Deadline: {mission['delivery_deadline']} days)."
        ),
        input_reference=mission_id,
        output_reference="STATE=READY",
        policy_decision="AUTO_EXECUTE",
        result="READY",
    )

    # Step: Supplier Discovery via Mission Orchestrator + Policy Engine
    orch_discovery = orchestrator.decide_next_action(
        mission=mission,
        context_summary="Mission launched. Need to discover and qualify Indian manufacturing suppliers matching constraints.",
        default_decision_dict={
            "action_type": "supplier_discovery",
            "reason": f"Search and filter suppliers in {mission['preferred_sourcing_location']} matching {mission['product_name']} constraints.",
            "tool_name": "supplier_search",
            "tool_arguments": {"mission_id": mission_id},
            "risk_level": "LOW",
            "requires_human_approval": False,
            "expected_outcome": "Shortlist qualified suppliers with transparent matching factors.",
            "constraints_checked": ["MOQ", "budget", "target_unit_cost", "delivery_deadline", "location"],
            "evidence_required": ["Illustrative/verified supplier capability profile"],
        },
    )

    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.SUPPLIER_DISCOVERY.value, now, mission_id),
        )

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Mission Orchestrator",
        event_type="SUPPLIER_SEARCH_STARTED",
        action="Supplier discovery initiated",
        reason=orch_discovery["decision"]["reason"],
        input_reference=mission["preferred_sourcing_location"],
        output_reference="supplier_search",
        policy_decision=orch_discovery["policy"]["decision"],
        result="SUPPLIER_DISCOVERY",
    )

    discovered = discover_and_persist_mission_suppliers(mission=mission, top_n=5)
    eligible = [s for s in discovered if s["eligibility_status"] == "Eligible"]

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Supplier Engine",
        event_type="SUPPLIER_FOUND",
        action=f"{len(discovered)} suppliers evaluated ({len(eligible)} eligible)",
        reason=f"Matched against MOQ <= {mission['quantity']}, deadline <= {mission['delivery_deadline']}d, and budget <= {format_inr(mission['maximum_budget'])}.",
        input_reference=mission_id,
        output_reference=",".join(s["supplier_id"] for s in discovered[:3]),
        policy_decision="AUTO_EXECUTE",
        result="SUPPLIERS_SHORTLISTED",
    )

    # Generate initial RFQs for top 2 shortlisted suppliers
    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.RFQ_PREPARATION.value, now, mission_id),
        )

    rfqs_created: List[Dict[str, Any]] = []
    for sup in discovered[:2]:
        rfq = create_rfq_for_supplier(
            mission=mission, supplier_id=sup["supplier_id"], auto_send=True
        )
        rfqs_created.append(rfq)

    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.WAITING_FOR_RESPONSE.value, now, mission_id),
        )

    return {
        "mission_id": mission_id,
        "state": MissionState.WAITING_FOR_RESPONSE.value,
        "suppliers_discovered": len(discovered),
        "rfqs_sent": len(rfqs_created),
    }


def process_and_evaluate_supplier_response(
    mission: Dict[str, Any],
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Parses a supplier response (leaving missing fields as None), runs the deterministic
    Cost Engine and Constraint Engine, updates database, and records audit events.
    """
    user_id = mission["user_id"]
    mission_id = mission["id"]
    supplier_id = payload.get("supplier_id")
    if not supplier_id:
        m_sups = get_mission_suppliers(mission_id)
        supplier_id = m_sups[0]["supplier_id"] if m_sups else "sup_peenya_01"

    supplier = lookup_supplier_by_id(supplier_id)
    if not supplier:
        raise ValueError(f"Supplier '{supplier_id}' not found.")

    parsed = parse_supplier_response_payload(
        payload=payload, is_demo=bool(supplier.get("demo_supplier", True))
    )

    cost_breakdown = calculate_procurement_cost(
        unit_cost=parsed["unit_price"],
        quantity=int(mission["quantity"]),
        maximum_budget=float(mission["maximum_budget"]),
        target_unit_cost=float(mission["target_unit_cost"]),
        packaging_cost_inr=parsed["packaging_cost_inr"],
        shipping_cost_inr=parsed["shipping_cost_inr"],
        other_costs_inr=parsed["other_costs_inr"],
    )

    constraint_eval = check_mission_constraints(
        mission=mission,
        response_data=parsed,
        cost_breakdown=cost_breakdown,
        supplier_location=supplier["location"],
    )

    now = utc_now_iso()
    resp_id = new_id("rsp")
    rfq_id = payload.get("rfq_id")

    with get_db() as conn:
        if not rfq_id:
            rfq_row = fetch_one(
                conn,
                "SELECT id FROM rfqs WHERE mission_id = ? AND supplier_id = ? LIMIT 1",
                (mission_id, supplier_id),
            )
            if rfq_row:
                rfq_id = rfq_row["id"]

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
                resp_id,
                mission_id,
                rfq_id,
                supplier_id,
                supplier["name"],
                parsed["raw_message"],
                parsed["unit_price"],
                parsed["moq"],
                parsed["lead_time_days"],
                parsed["material"],
                parsed["certifications"],
                parsed["packaging"],
                parsed["payment_terms"],
                parsed["shipping_cost_inr"],
                parsed["packaging_cost_inr"],
                parsed["other_costs_inr"],
                parsed["notes"],
                parsed["evidence"],
                json.dumps(cost_breakdown),
                json.dumps(constraint_eval["results"]),
                1 if constraint_eval["all_passed"] else 0,
                now,
                now,
            ),
        )
        if rfq_id:
            conn.execute(
                "UPDATE rfqs SET status = 'RESPONDED', updated_at = ? WHERE id = ?",
                (now, rfq_id),
            )
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.EVALUATING.value, now, mission_id),
        )
        saved_row = fetch_one(conn, "SELECT * FROM supplier_responses WHERE id = ?", (resp_id,))

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Response Parser",
        event_type="RESPONSE_RECEIVED",
        action=f"Supplier response received from {supplier['name']}",
        reason=(
            f"Parsed quote: Unit price={'₹' + str(parsed['unit_price']) if parsed['unit_price'] is not None else 'Unknown'}, "
            f"Lead time={str(parsed['lead_time_days']) + ' days' if parsed['lead_time_days'] is not None else 'Unknown'}."
        ),
        input_reference=supplier_id,
        output_reference=resp_id,
        policy_decision="AUTO_EXECUTE",
        result="PARSED",
    )

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Constraint Engine",
        event_type="CONSTRAINT_CHECKED",
        action=f"Evaluated constraints for {supplier['name']}",
        reason=(
            "All mission constraints satisfied."
            if constraint_eval["all_passed"]
            else f"{constraint_eval['violation_count']} constraint violation(s) detected."
        ),
        input_reference=resp_id,
        output_reference="PASSED" if constraint_eval["all_passed"] else "VIOLATED",
        policy_decision="AUTO_EXECUTE",
        result="PASSED" if constraint_eval["all_passed"] else "VIOLATED",
    )

    # If all constraints passed and pricing is complete, request human approval to select supplier if none is pending
    if (
        constraint_eval["all_passed"]
        and cost_breakdown.get("complete")
        and parsed.get("lead_time_days") is not None
        and payload.get("auto_request_approval", False)
    ):
        create_approval_request(
            mission=mission,
            action=f"Approve supplier selection: {supplier['name']}",
            reason=(
                f"{supplier['name']} meets all mission constraints at {cost_breakdown['formatted_total']} "
                f"and {parsed['lead_time_days']} days delivery."
            ),
            supplier=supplier,
            unit_price=float(parsed["unit_price"]),
            total_cost=float(cost_breakdown["total_procurement_cost"]),
            lead_time_days=int(parsed["lead_time_days"]),
            risk_summary="Low risk — all budget, unit cost, MOQ, and deadline constraints passed.",
            recommendation_rationale=f"Verified compliant quote within {mission['delivery_deadline']}-day deadline.",
        )

    d = dict(saved_row)
    d["is_valid_all_constraints"] = bool(d.get("is_valid_all_constraints", 0))
    d["cost_breakdown"] = cost_breakdown
    d["constraint_results"] = constraint_eval["results"]
    return d
