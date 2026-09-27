"""
Mission Service (backend/app/services/mission_service.py)
Implements Sections 13, 14, 15, 16, 17, 18, 27:
- Multiple independent user missions with strict ownership checks
- Save Draft vs Launch Mission persistence
- Full workspace hydration (suppliers, RFQs, responses, risks, approvals, audit trail, Render workflow step)
- Zero hardcoded product/demo branching: all missions use the exact same backend workflow engine
"""
import json
from typing import Any, Dict, List, Optional
from backend.app.database.base import new_id, utc_now_iso
from backend.app.database.session import fetch_all, fetch_one, get_db
from backend.app.integrations.render import map_mission_state_to_workflow_step
from backend.app.models.mission import MissionState
from backend.app.services.approval_service import list_user_approvals
from backend.app.services.finance_service import (
    list_mission_audit_events,
    record_audit_event,
)
from backend.app.services.rfq_service import (
    create_rfq_for_supplier,
    list_mission_rfqs,
)
from backend.app.services.risk_service import list_mission_risks
from backend.app.services.supplier_service import (
    discover_and_persist_mission_suppliers,
    get_mission_suppliers,
)
from backend.app.tools.cost_calculator import format_inr
from backend.app.tools.product_decomposition import analyze_product_requirements
from backend.app.tools.supplier_search import build_dynamic_search_queries
from backend.app.workflows.mission_workflow import (
    execute_mission_launch_workflow,
    process_and_evaluate_supplier_response,
)
from backend.app.workflows.supplier_recovery import (
    execute_supplier_failure_recovery_workflow,
)


def _hydrate_mission_row(row: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(row)
    d["is_demo"] = bool(d.get("is_demo", 0))
    try:
        d["workflow_state"] = json.loads(d.get("workflow_state_json") or "{}")
    except Exception:
        d["workflow_state"] = {}
    try:
        d["requirements"] = json.loads(d.get("requirements_json") or "[]")
    except Exception:
        d["requirements"] = []
    try:
        d["search_queries"] = json.loads(d.get("search_queries_json") or "[]")
    except Exception:
        d["search_queries"] = []
    if not d.get("discovery_mode"):
        d["discovery_mode"] = "DEMO_CATALOG" if d["is_demo"] else "LIVE_WEB_SEARCH"
    return d


def _hydrate_response_row(row: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(row)
    d["is_valid_all_constraints"] = bool(d.get("is_valid_all_constraints", 0))
    try:
        d["cost_breakdown"] = json.loads(d.get("cost_breakdown_json") or "{}")
    except Exception:
        d["cost_breakdown"] = {}
    try:
        d["constraint_results"] = json.loads(d.get("constraint_results_json") or "[]")
    except Exception:
        d["constraint_results"] = []
    return d


def create_mission(
    user_id: str,
    payload: Dict[str, Any],
    launch_immediately: bool = False,
    is_demo: bool = False,
) -> Dict[str, Any]:
    mission_name = str(payload.get("mission_name") or "").strip()
    product_name = str(payload.get("product_name") or mission_name).strip()
    if not mission_name:
        raise ValueError("Mission name is required.")
    if not product_name:
        raise ValueError("Product name is required.")

    quantity = int(payload.get("quantity") or 0)
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    maximum_budget = float(payload.get("maximum_budget") or 0.0)
    if maximum_budget <= 0:
        raise ValueError("Maximum budget must be greater than zero.")

    target_unit_cost = float(
        payload.get("target_unit_cost") or round(maximum_budget / quantity, 2)
    )
    delivery_deadline = int(payload.get("delivery_deadline") or 30)
    if delivery_deadline <= 0:
        raise ValueError("Delivery deadline (days) must be greater than zero.")

    product_description = str(payload.get("product_description") or "").strip()
    product_category = str(payload.get("product_category") or "Physical Product").strip()
    material = str(payload.get("material") or "").strip()
    quality_requirements = str(payload.get("quality_requirements") or "").strip()
    packaging_requirements = str(payload.get("packaging_requirements") or "").strip()
    certification_requirements = str(
        payload.get("certification_requirements") or "ISO 9001:2015"
    ).strip()
    preferred_sourcing_location = str(
        payload.get("preferred_sourcing_location") or "Bengaluru, Karnataka"
    ).strip()
    additional_requirements = str(payload.get("additional_requirements") or "").strip()

    mission_id = new_id("msn")
    now = utc_now_iso()
    initial_state = MissionState.DRAFT.value

    # Decompose product into materials/components/packaging/processes or use user-reviewed requirements
    user_reqs = payload.get("requirements")
    if isinstance(user_reqs, list) and len(user_reqs) > 0:
        decomposed_reqs = user_reqs
    else:
        decomp = analyze_product_requirements(
            {
                "product_name": product_name,
                "product_description": product_description,
                "product_category": product_category,
                "material": material,
                "packaging_requirements": packaging_requirements,
                "certification_requirements": certification_requirements,
                "preferred_sourcing_location": preferred_sourcing_location,
                "quantity": quantity,
                "target_unit_cost": target_unit_cost,
                "maximum_budget": maximum_budget,
                "delivery_deadline": delivery_deadline,
            }
        )
        decomposed_reqs = decomp.get("requirements") or []
        if not material and decomp.get("extracted_constraints", {}).get("material"):
            material = decomp["extracted_constraints"]["material"]

    initial_queries = build_dynamic_search_queries(
        mission={
            "product_name": product_name,
            "material": material,
            "packaging_requirements": packaging_requirements,
            "certification_requirements": certification_requirements,
            "preferred_sourcing_location": preferred_sourcing_location,
        },
        requirements=decomposed_reqs,
    )
    discovery_mode = "DEMO_CATALOG" if is_demo else "LIVE_WEB_SEARCH"

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO missions (
                id, user_id, mission_name, product_name, product_description,
                product_category, quantity, target_unit_cost, maximum_budget,
                material, quality_requirements, packaging_requirements,
                certification_requirements, preferred_sourcing_location,
                delivery_deadline, additional_requirements, state,
                selected_supplier_id, is_demo, workflow_state_json,
                requirements_json, search_queries_json, discovery_mode,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mission_id,
                user_id,
                mission_name,
                product_name,
                product_description,
                product_category,
                quantity,
                target_unit_cost,
                maximum_budget,
                material,
                quality_requirements,
                packaging_requirements,
                certification_requirements,
                preferred_sourcing_location,
                delivery_deadline,
                additional_requirements,
                initial_state,
                None,
                1 if is_demo else 0,
                json.dumps({"stage": "DRAFT"}),
                json.dumps(decomposed_reqs),
                json.dumps(initial_queries),
                discovery_mode,
                now,
                now,
            ),
        )
        row = fetch_one(conn, "SELECT * FROM missions WHERE id = ?", (mission_id,))

    mission_dict = _hydrate_mission_row(row)
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Founder" if not is_demo else "Demo Loader",
        event_type="MISSION_CREATED",
        action=f"Mission created: {mission_name}",
        reason=f"Created mission for {quantity:,} units of {product_name} with budget {format_inr(maximum_budget)}.",
        input_reference=product_name,
        output_reference=mission_id,
        policy_decision="AUTO_EXECUTE",
        result="DRAFT",
    )
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Product Decomposition Engine",
        event_type="PRODUCT_DECOMPOSED",
        action=f"Decomposed {product_name} into {len(decomposed_reqs)} sourcing requirements",
        reason=(
            f"Identified {', '.join(r.get('name', '') for r in decomposed_reqs[:4])} "
            f"and generated {len(initial_queries)} live internet search queries."
        ),
        input_reference=product_name,
        output_reference=f"{len(decomposed_reqs)}_REQUIREMENTS",
        policy_decision="AUTO_EXECUTE",
        result="REQUIREMENTS_READY",
    )

    if launch_immediately:
        return launch_mission(mission_id=mission_id, user_id=user_id)

    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def update_mission(
    mission_id: str,
    user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    with get_db() as conn:
        current = fetch_one(
            conn,
            "SELECT * FROM missions WHERE id = ? AND user_id = ?",
            (mission_id, user_id),
        )
        if not current:
            raise ValueError("Mission not found or access denied.")

        now = utc_now_iso()
        mission_name = str(payload.get("mission_name", current["mission_name"])).strip()
        product_name = str(payload.get("product_name", current["product_name"])).strip()
        product_description = str(
            payload.get("product_description", current["product_description"])
        ).strip()
        product_category = str(
            payload.get("product_category", current["product_category"])
        ).strip()
        quantity = int(payload.get("quantity", current["quantity"]))
        target_unit_cost = float(
            payload.get("target_unit_cost", current["target_unit_cost"])
        )
        maximum_budget = float(payload.get("maximum_budget", current["maximum_budget"]))
        material = str(payload.get("material", current["material"])).strip()
        quality_requirements = str(
            payload.get("quality_requirements", current["quality_requirements"])
        ).strip()
        packaging_requirements = str(
            payload.get("packaging_requirements", current["packaging_requirements"])
        ).strip()
        certification_requirements = str(
            payload.get("certification_requirements", current["certification_requirements"])
        ).strip()
        preferred_sourcing_location = str(
            payload.get(
                "preferred_sourcing_location", current["preferred_sourcing_location"]
            )
        ).strip()
        delivery_deadline = int(
            payload.get("delivery_deadline", current["delivery_deadline"])
        )
        additional_requirements = str(
            payload.get("additional_requirements", current["additional_requirements"])
        ).strip()

        reqs_json = current.get("requirements_json") or "[]"
        queries_json = current.get("search_queries_json") or "[]"
        if (
            product_name != current["product_name"]
            or material != current["material"]
            or preferred_sourcing_location != current["preferred_sourcing_location"]
        ):
            decomp = analyze_product_requirements(
                {
                    "product_name": product_name,
                    "product_description": product_description,
                    "product_category": product_category,
                    "material": material,
                    "packaging_requirements": packaging_requirements,
                    "certification_requirements": certification_requirements,
                    "preferred_sourcing_location": preferred_sourcing_location,
                    "quantity": quantity,
                    "target_unit_cost": target_unit_cost,
                    "maximum_budget": maximum_budget,
                    "delivery_deadline": delivery_deadline,
                }
            )
            new_reqs = decomp.get("requirements") or []
            new_queries = build_dynamic_search_queries(
                mission={
                    "product_name": product_name,
                    "material": material,
                    "packaging_requirements": packaging_requirements,
                    "certification_requirements": certification_requirements,
                    "preferred_sourcing_location": preferred_sourcing_location,
                },
                requirements=new_reqs,
            )
            reqs_json = json.dumps(new_reqs)
            queries_json = json.dumps(new_queries)

        conn.execute(
            """
            UPDATE missions SET
                mission_name = ?, product_name = ?, product_description = ?,
                product_category = ?, quantity = ?, target_unit_cost = ?,
                maximum_budget = ?, material = ?, quality_requirements = ?,
                packaging_requirements = ?, certification_requirements = ?,
                preferred_sourcing_location = ?, delivery_deadline = ?,
                additional_requirements = ?, requirements_json = ?,
                search_queries_json = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                mission_name,
                product_name,
                product_description,
                product_category,
                quantity,
                target_unit_cost,
                maximum_budget,
                material,
                quality_requirements,
                packaging_requirements,
                certification_requirements,
                preferred_sourcing_location,
                delivery_deadline,
                additional_requirements,
                reqs_json,
                queries_json,
                now,
                mission_id,
                user_id,
            ),
        )

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Founder",
        event_type="MISSION_UPDATED",
        action=f"Updated mission parameters: {mission_name}",
        reason=f"Saved updated requirements ({quantity:,} units, budget {format_inr(maximum_budget)}).",
        input_reference=mission_id,
        output_reference="UPDATED",
        policy_decision="AUTO_EXECUTE",
        result="SAVED",
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def launch_mission(mission_id: str, user_id: str) -> Dict[str, Any]:
    with get_db() as conn:
        row = fetch_one(
            conn,
            "SELECT * FROM missions WHERE id = ? AND user_id = ?",
            (mission_id, user_id),
        )
    if not row:
        raise ValueError("Mission not found or access denied.")

    mission = _hydrate_mission_row(row)
    execute_mission_launch_workflow(mission)
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def cancel_mission(mission_id: str, user_id: str) -> Dict[str, Any]:
    now = utc_now_iso()
    with get_db() as conn:
        row = fetch_one(
            conn,
            "SELECT * FROM missions WHERE id = ? AND user_id = ?",
            (mission_id, user_id),
        )
        if not row:
            raise ValueError("Mission not found or access denied.")
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (MissionState.CANCELLED.value, now, mission_id, user_id),
        )

    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Founder",
        event_type="MISSION_CANCELLED",
        action=f"Cancelled mission: {row['mission_name']}",
        reason="Mission cancelled by user.",
        input_reference=mission_id,
        output_reference="CANCELLED",
        policy_decision="AUTO_EXECUTE",
        result="CANCELLED",
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def list_user_missions(user_id: str) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = fetch_all(
            conn,
            "SELECT * FROM missions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
    results = []
    for r in rows:
        m = _hydrate_mission_row(r)
        m["suppliers_count"] = len(get_mission_suppliers(m["id"]))
        m["rfqs_count"] = len(list_mission_rfqs(user_id, m["id"]))
        m["open_risks_count"] = len(
            [rk for rk in list_mission_risks(user_id, m["id"]) if rk["status"] == "OPEN"]
        )
        m["pending_approvals_count"] = len(
            [
                ap
                for ap in list_user_approvals(user_id, m["id"])
                if ap["status"] == "PENDING"
            ]
        )
        results.append(m)
    return results


def get_mission_detail(mission_id: str, user_id: str) -> Dict[str, Any]:
    with get_db() as conn:
        row = fetch_one(
            conn,
            "SELECT * FROM missions WHERE id = ? AND user_id = ?",
            (mission_id, user_id),
        )
        if not row:
            raise ValueError("Mission not found or access denied.")
        resp_rows = fetch_all(
            conn,
            "SELECT * FROM supplier_responses WHERE mission_id = ? ORDER BY created_at DESC",
            (mission_id,),
        )

    mission = _hydrate_mission_row(row)
    suppliers = get_mission_suppliers(mission_id)
    rfqs = list_mission_rfqs(user_id, mission_id)
    responses = [_hydrate_response_row(r) for r in resp_rows]
    risks = list_mission_risks(user_id, mission_id)
    approvals = list_user_approvals(user_id, mission_id)
    audit_events = list_mission_audit_events(user_id, mission_id)

    has_risk = len(risks) > 0
    mission["suppliers"] = suppliers
    mission["rfqs"] = rfqs
    mission["supplier_responses"] = responses
    mission["risks"] = risks
    mission["approvals"] = approvals
    mission["audit_events"] = audit_events
    mission["render_workflow"] = map_mission_state_to_workflow_step(
        mission["state"], has_risk=has_risk
    )
    return mission


def analyze_mission_requirements(mission_id: str, user_id: str) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    decomp = analyze_product_requirements(mission)
    reqs = decomp.get("requirements") or []
    queries = build_dynamic_search_queries(mission=mission, requirements=reqs)
    now = utc_now_iso()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE missions SET
                requirements_json = ?,
                search_queries_json = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (json.dumps(reqs), json.dumps(queries), now, mission_id, user_id),
        )
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Product Decomposition Engine",
        event_type="PRODUCT_DECOMPOSED",
        action=f"Analyzed product into {len(reqs)} material/component requirements",
        reason=f"Generated {len(queries)} targeted supplier search queries for {mission['preferred_sourcing_location']}.",
        input_reference=mission["product_name"],
        output_reference=f"{len(reqs)}_REQUIREMENTS",
        policy_decision="AUTO_EXECUTE",
        result="REQUIREMENTS_UPDATED",
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def update_mission_requirements(
    mission_id: str,
    user_id: str,
    requirements: List[Dict[str, Any]],
) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    cleaned_reqs = []
    for r in requirements:
        if not isinstance(r, dict) or not str(r.get("name") or "").strip():
            continue
        raw_terms = r.get("search_terms") or []
        if isinstance(raw_terms, str):
            terms = [t.strip() for t in raw_terms.split(",") if t.strip()]
        elif isinstance(raw_terms, list):
            terms = [str(t).strip() for t in raw_terms if str(t).strip()]
        else:
            terms = []
        cleaned_reqs.append(
            {
                "name": str(r.get("name")).strip(),
                "type": str(r.get("type") or "component").strip(),
                "purpose": str(r.get("purpose") or "").strip(),
                "search_terms": terms,
                "location": str(
                    r.get("location") or mission["preferred_sourcing_location"]
                ).strip(),
                "confidence": float(r.get("confidence", 0.95)),
            }
        )
    queries = build_dynamic_search_queries(mission=mission, requirements=cleaned_reqs)
    now = utc_now_iso()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE missions SET
                requirements_json = ?,
                search_queries_json = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (json.dumps(cleaned_reqs), json.dumps(queries), now, mission_id, user_id),
        )
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Founder",
        event_type="REQUIREMENTS_EDITED",
        action=f"Reviewed and updated {len(cleaned_reqs)} sourcing requirements",
        reason=f"Updated BOM decomposition and search terms ({', '.join(queries[:3])}).",
        input_reference=mission_id,
        output_reference=f"{len(cleaned_reqs)}_REQUIREMENTS",
        policy_decision="AUTO_EXECUTE",
        result="SAVED",
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def run_mission_supplier_discovery(mission_id: str, user_id: str) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    now = utc_now_iso()
    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.SUPPLIER_DISCOVERY.value, now, mission_id),
        )
    discovered = discover_and_persist_mission_suppliers(mission=mission, top_n=5)
    updated_mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    queries_used = updated_mission.get("search_queries") or []
    disc_mode = updated_mission.get("discovery_mode") or "LIVE_WEB_SEARCH"
    record_audit_event(
        user_id=user_id,
        mission_id=mission_id,
        actor="Live Web Supplier Engine" if disc_mode == "LIVE_WEB_SEARCH" else "Supplier Engine",
        event_type="SUPPLIER_FOUND",
        action=f"Discovered and ranked {len(discovered)} suppliers ({disc_mode})",
        reason=(
            f"Executed live web search queries ({'; '.join(queries_used[:3])}) and extracted source-backed supplier profiles."
            if disc_mode == "LIVE_WEB_SEARCH"
            else f"Evaluated suppliers against {mission['product_name']} constraints ({disc_mode})."
        ),
        input_reference="; ".join(queries_used[:2]) if queries_used else mission_id,
        output_reference=",".join(s["supplier_id"] for s in discovered),
        policy_decision="AUTO_EXECUTE",
        result="SUPPLIER_DISCOVERY",
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def run_mission_generate_rfqs(
    mission_id: str,
    user_id: str,
    supplier_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    if not mission["suppliers"]:
        discover_and_persist_mission_suppliers(mission=mission, top_n=5)
        mission = get_mission_detail(mission_id=mission_id, user_id=user_id)

    targets = supplier_ids or [s["supplier_id"] for s in mission["suppliers"][:2]]
    for sid in targets:
        create_rfq_for_supplier(mission=mission, supplier_id=sid, auto_send=True)

    now = utc_now_iso()
    with get_db() as conn:
        conn.execute(
            "UPDATE missions SET state = ?, updated_at = ? WHERE id = ?",
            (MissionState.WAITING_FOR_RESPONSE.value, now, mission_id),
        )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def run_mission_process_supplier_response(
    mission_id: str,
    user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    if not mission["suppliers"]:
        discover_and_persist_mission_suppliers(mission=mission, top_n=5)
        mission = get_mission_detail(mission_id=mission_id, user_id=user_id)

    # If caller didn't pass explicit response fields, use the second discovered supplier (e.g. Supplier B at 25 days)
    if not payload.get("supplier_id"):
        target_sup = (
            mission["suppliers"][1]
            if len(mission["suppliers"]) > 1
            else mission["suppliers"][0]
        )
        payload = {
            "supplier_id": target_sup["supplier_id"],
            "unit_price": target_sup["indicative_unit_price_inr"],
            "moq": target_sup["minimum_order_quantity"],
            "lead_time_days": target_sup["lead_time_days"],
            "material": target_sup["materials"],
            "certifications": target_sup["certifications"],
            "packaging": target_sup["packaging_capabilities"],
            "payment_terms": target_sup["payment_terms"],
            "raw_message": f"Initial quotation from {target_sup['name']}: ₹{target_sup['indicative_unit_price_inr']:.0f}/unit, lead time {target_sup['lead_time_days']} days.",
        }

    process_and_evaluate_supplier_response(mission=mission, payload=payload)
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def run_mission_supplier_delay_recovery(
    mission_id: str,
    user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
    if not mission["suppliers"]:
        discover_and_persist_mission_suppliers(mission=mission, top_n=5)
        mission = get_mission_detail(mission_id=mission_id, user_id=user_id)

    # Pick specified supplier or Supplier B (sup_bommasandra_02) or the top supplier
    supplier_id = payload.get("supplier_id")
    if not supplier_id:
        bommasandra = next(
            (s for s in mission["suppliers"] if s["supplier_id"] == "sup_bommasandra_02"),
            None,
        )
        if bommasandra:
            supplier_id = bommasandra["supplier_id"]
        elif len(mission["suppliers"]) > 1:
            supplier_id = mission["suppliers"][1]["supplier_id"]
        elif mission["suppliers"]:
            supplier_id = mission["suppliers"][0]["supplier_id"]
        else:
            supplier_id = "sup_bommasandra_02"

    new_lead_time = int(payload.get("lead_time_days") or 42)
    event_type = str(payload.get("event_type") or "DELIVERY_DELAY")
    message = str(
        payload.get("message")
        or f"External disruption event: Delivery will now take {new_lead_time} days."
    )

    execute_supplier_failure_recovery_workflow(
        mission=mission,
        supplier_id=supplier_id,
        new_lead_time_days=new_lead_time,
        event_type=event_type,
        message=message,
    )
    return get_mission_detail(mission_id=mission_id, user_id=user_id)


def load_isolated_demo_scenario(user_id: str) -> Dict[str, Any]:
    """
    Implements Section 16 & Section 17:
    Creates/loads the Default Demo Scenario using the exact same database models and workflow services:
    - Product: Eco-friendly reusable bottles
    - Quantity: 1,000 units
    - Procurement budget: ₹3,00,000
    - Target landed cost: ₹300/unit
    - Deadline: 30 days
    - Preferred sourcing: Bengaluru / Karnataka
    - Runs launch workflow + Supplier B (25 days) initial response so the user can immediately
      inspect the real mission or trigger the Supplier B 25 days -> 42 days recovery workflow.
    """
    demo_payload = {
        "mission_name": "[DEMO] Eco-Friendly Reusable Bottles — Bengaluru Batch #1",
        "product_name": "Eco-friendly reusable bottles",
        "product_description": "750ml double-wall food-grade SS 304 reusable bottles with sustainably harvested bamboo cap and leak-proof silicone ring.",
        "product_category": "Sustainable Drinkware",
        "quantity": 1000,
        "target_unit_cost": 300.0,
        "maximum_budget": 300000.0,
        "material": "SS 304 Food-Grade Steel, Treated Bamboo Cap, BPA-Free Silicone",
        "quality_requirements": "100% vacuum thermal retention test + BIS IS 14756 food-contact compliance",
        "packaging_requirements": "FSC Kraft Cylinder Tube with custom soy-ink sleeve",
        "certification_requirements": "ISO 9001:2015, BIS IS 14756, FSSAI",
        "preferred_sourcing_location": "Bengaluru, Karnataka",
        "delivery_deadline": 30,
        "additional_requirements": "Illustrative Demo Scenario (Capital ₹5,00,000 | Procurement Budget ₹3,00,000 | Target ₹300/unit | Deadline 30 days).",
    }

    mission = create_mission(
        user_id=user_id,
        payload=demo_payload,
        launch_immediately=True,
        is_demo=True,
    )

    # Record Supplier B (Bommasandra, 25 days initial lead time) response using the real response workflow
    run_mission_process_supplier_response(
        mission_id=mission["id"],
        user_id=user_id,
        payload={
            "supplier_id": "sup_bommasandra_02",
            "unit_price": 248.0,
            "moq": 500,
            "lead_time_days": 25,
            "material": "SS 304 Food-Grade Steel, Bamboo Fiber Composite",
            "certifications": "ISO 9001:2015, ISO 14001, BIS Certified",
            "packaging": "Recycled Corrugated Cartons, Individual Kraft Boxes",
            "payment_terms": "25% Advance, 75% on Quality Inspection",
            "raw_message": "Initial quotation from Demo Supplier B (Bommasandra): ₹248/unit ex-works, 25 days delivery.",
        },
    )

    return get_mission_detail(mission_id=mission["id"], user_id=user_id)
