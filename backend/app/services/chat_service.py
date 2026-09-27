"""
Vendra AI Chatbot Service (backend/app/services/chat_service.py)
Connects the Vendra AI Chatbot to the exact same real backend services used by the main UI:
- `supplier_discovery_service.discover_suppliers_live` (Real Live Internet Supplier Search)
- `product_decomposition.analyze_product_requirements` (AI Material/Component Decomposition)
- `mission_service` (Mission creation, supplier discovery, RFQ generation, delay recovery, status)
- `approval_service` & `risk_service` (Human-in-the-Loop approvals & constraint risk monitoring)
"""
import json
import re
from typing import Any, Dict, List, Optional
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, get_db
from app.integrations.gemini import call_gemini_text
from app.services.approval_service import list_user_approvals
from app.services.finance_service import record_audit_event
from app.services.mission_service import (
    analyze_mission_requirements,
    create_mission,
    get_mission_detail,
    list_user_missions,
    run_mission_generate_rfqs,
    run_mission_supplier_delay_recovery,
    run_mission_supplier_discovery,
)
from app.services.risk_service import list_mission_risks
from app.services.supplier_discovery_service import discover_suppliers_live
from app.services.supplier_service import upsert_supplier_record
from app.tools.cost_calculator import format_inr
from app.tools.product_decomposition import analyze_product_requirements


def list_chat_history(
    user_id: str, mission_id: Optional[str] = None, limit: int = 40
) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if mission_id:
            rows = fetch_all(
                conn,
                """
                SELECT * FROM chat_messages
                WHERE user_id = ? AND (mission_id = ? OR mission_id IS NULL)
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (user_id, mission_id, limit),
            )
        else:
            rows = fetch_all(
                conn,
                """
                SELECT * FROM chat_messages
                WHERE user_id = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (user_id, limit),
            )
    results = []
    for r in rows:
        item = dict(r)
        try:
            item["metadata"] = json.loads(item.get("metadata_json") or "{}")
        except Exception:
            item["metadata"] = {}
        results.append(item)
    return results


def _save_chat_message(
    user_id: str,
    mission_id: Optional[str],
    role: str,
    content: str,
    intent: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    msg_id = new_id("chat")
    now = utc_now_iso()
    meta_dict = metadata or {}
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (
                id, user_id, mission_id, role, content, intent, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                msg_id,
                user_id,
                mission_id,
                role,
                content,
                intent,
                json.dumps(meta_dict),
                now,
            ),
        )
    return {
        "id": msg_id,
        "user_id": user_id,
        "mission_id": mission_id,
        "role": role,
        "content": content,
        "intent": intent,
        "metadata": meta_dict,
        "created_at": now,
    }


def _detect_chat_intent(message: str, has_active_mission: bool) -> str:
    lower = message.lower().strip()

    # 1. Create / launch a new mission
    if any(
        phrase in lower
        for phrase in [
            "create a mission",
            "create mission",
            "start a mission",
            "launch a mission",
            "new mission for",
            "i want to manufacture",
            "we want to manufacture",
        ]
    ):
        return "CREATE_MISSION"

    # 2. Generate / send RFQs
    if any(
        phrase in lower
        for phrase in [
            "generate rfq",
            "send rfq",
            "create rfq",
            "dispatch rfq",
            "draft rfq",
        ]
    ):
        return "GENERATE_RFQS"

    # 3. Delay / failure recovery
    if any(
        phrase in lower
        for phrase in [
            "simulate delay",
            "cannot deliver",
            "delayed",
            "delay recovery",
            "supplier b cannot",
            "violated deadline",
        ]
    ):
        return "DELAY_RECOVERY"

    # 4. Material / BOM Decomposition specifically
    if any(
        phrase in lower
        for phrase in [
            "decompose",
            "what materials",
            "bill of materials",
            "bom for",
            "analyze product",
            "material requirements for",
            "components needed for",
        ]
    ) and "supplier" not in lower and "search" not in lower and "find" not in lower:
        return "DECOMPOSE_PRODUCT"

    # 5. Live Supplier Discovery / Search
    if any(
        kw in lower
        for kw in [
            "find supplier",
            "find manufacturers",
            "search supplier",
            "discover supplier",
            "live search",
            "suppliers for",
            "manufacturers for",
            "suppliers in ",
            "manufacturers in ",
            "who can supply",
            "who manufactures",
            "source ",
            "gsm paper",
            "duplex board",
            "spiral wire",
            "binding wire",
            "stainless steel",
            "silicone",
            "bamboo",
            "packaging supplier",
        ]
    ):
        return "LIVE_SUPPLIER_SEARCH"

    # 6. Mission status / approvals / cost / risk questions
    if has_active_mission or any(
        kw in lower
        for kw in [
            "status",
            "approval",
            "risk",
            "cost",
            "budget",
            "which supplier",
            "recommend",
            "why",
            "mission",
        ]
    ):
        return "MISSION_ANALYSIS"

    return "LIVE_SUPPLIER_SEARCH"


def process_chat_message(
    user: Dict[str, Any],
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Processes a user message in the Vendra AI Chatbot, invokes the real backend services
    (Supplier Discovery Service, Product Decomposition, Mission Service, RFQ Service),
    persists the conversation, and returns a structured, source-backed response.
    """
    user_id = user["id"]
    message = str(payload.get("message") or payload.get("question") or "").strip()
    if not message:
        raise ValueError("Chat message cannot be empty.")

    mission_id = str(payload.get("mission_id") or "").strip() or None
    active_mission: Optional[Dict[str, Any]] = None
    if mission_id:
        try:
            active_mission = get_mission_detail(mission_id=mission_id, user_id=user_id)
        except Exception:
            active_mission = None

    if not active_mission:
        user_missions = list_user_missions(user_id)
        if user_missions:
            try:
                active_mission = get_mission_detail(
                    mission_id=user_missions[0]["id"], user_id=user_id
                )
            except Exception:
                active_mission = None

    intent = _detect_chat_intent(message, has_active_mission=active_mission is not None)

    # Save user message
    user_msg_record = _save_chat_message(
        user_id=user_id,
        mission_id=active_mission["id"] if active_mission else mission_id,
        role="user",
        content=message,
        intent=intent,
    )

    reply_text = ""
    action_taken = ""
    returned_suppliers: List[Dict[str, Any]] = []
    returned_requirements: List[Dict[str, Any]] = []
    returned_queries: List[str] = []
    updated_mission: Optional[Dict[str, Any]] = active_mission

    # =========================================================================
    # INTENT 1: CREATE_MISSION
    # =========================================================================
    if intent == "CREATE_MISSION":
        decomp = analyze_product_requirements({"prompt": message})
        constraints = decomp["extracted_constraints"]
        reqs = decomp["requirements"]
        prod_name = constraints["product_name"] or "Custom Manufacturing Product"
        new_msn = create_mission(
            user_id=user_id,
            payload={
                "mission_name": f"{prod_name} Sourcing Mission",
                "product_name": prod_name,
                "product_description": message,
                "product_category": "Manufactured Goods",
                "quantity": constraints["quantity"],
                "target_unit_cost": constraints["target_unit_cost"],
                "maximum_budget": constraints["maximum_budget"],
                "delivery_deadline": constraints["delivery_deadline"],
                "preferred_sourcing_location": constraints["preferred_sourcing_location"],
                "material": constraints["material"],
                "requirements": reqs,
            },
            launch_immediately=True,
            is_demo=False,
        )
        updated_mission = new_msn
        returned_suppliers = new_msn.get("suppliers") or []
        returned_requirements = new_msn.get("requirements") or []
        returned_queries = new_msn.get("search_queries") or []
        action_taken = f"Created & Launched Mission '{new_msn['mission_name']}' ({new_msn['id']}) with Live Internet Supplier Discovery"

        sup_lines = []
        for s in returned_suppliers[:5]:
            s_type = str(s.get("supplier_type") or "MANUFACTURER").replace("_", " ")
            sup_lines.append(
                f"• {s.get('supplier_name') or s.get('name')} [{s_type}] ({s.get('location')}) — "
                f"Requirement: {s.get('matched_requirement')} · "
                f"Price: {s.get('price_display')} · MOQ: {s.get('moq_display')}"
            )
        req_names = ", ".join(r["name"] for r in returned_requirements[:5])
        reply_text = (
            f"Created and launched sourcing mission {new_msn['mission_name']} "
            f"for {new_msn['quantity']:,} units in {new_msn['preferred_sourcing_location']} "
            f"(Target: {format_inr(new_msn['target_unit_cost'])}/unit, Max Budget: {format_inr(new_msn['maximum_budget'])}, Deadline: ≤{new_msn['delivery_deadline']} days).\n\n"
            f"1. Upstream Material & Component Decomposition ({len(returned_requirements)} items):\n{req_names}\n\n"
            f"2. Dynamic B2B Search Queries Executed:\n"
            + "\n".join(f"• {q}" for q in returned_queries[:5])
            + f"\n\n3. Upstream B2B Suppliers Discovered ({len(returned_suppliers)}):\n"
            + ("\n".join(sup_lines) if sup_lines else "No public web listings matched.")
        )

    # =========================================================================
    # INTENT 2: DECOMPOSE_PRODUCT
    # =========================================================================
    elif intent == "DECOMPOSE_PRODUCT":
        if active_mission and (
            active_mission["product_name"].lower() in message.lower()
            or "this mission" in message.lower()
            or "current mission" in message.lower()
        ):
            updated_mission = analyze_mission_requirements(
                mission_id=active_mission["id"], user_id=user_id
            )
            returned_requirements = updated_mission.get("requirements") or []
            returned_queries = updated_mission.get("search_queries") or []
            prod_title = updated_mission["product_name"]
            action_taken = f"Decomposed '{prod_title}' into {len(returned_requirements)} BOM requirements"
        else:
            decomp = analyze_product_requirements({"prompt": message})
            returned_requirements = decomp.get("requirements") or []
            prod_title = decomp.get("product") or "Product"
            returned_queries = [
                st
                for r in returned_requirements
                for st in (r.get("search_terms") or [])
            ][:6]
            action_taken = f"Analyzed & Decomposed '{prod_title}' into {len(returned_requirements)} sourcing requirements"

        req_bullets = "\n".join(
            f"• {r['name']} ({str(r.get('type') or 'raw_material').replace('_', ' ').upper()}) — {r['purpose']}"
            for r in returned_requirements
        )
        reply_text = (
            f"Upstream Material & Component Decomposition for {prod_title}:\n\n"
            f"{req_bullets}\n\n"
            "Select any requirement below or ask me to find live raw-material and component suppliers."
        )

    # =========================================================================
    # INTENT 3: LIVE_SUPPLIER_SEARCH
    # =========================================================================
    elif intent == "LIVE_SUPPLIER_SEARCH":
        # Check if user is asking to run discovery for the currently active mission without specifying a new product
        lower_msg = message.lower()
        is_for_active_mission = active_mission is not None and (
            "this mission" in lower_msg
            or "current mission" in lower_msg
            or lower_msg.strip() in ("discover suppliers", "find suppliers", "search suppliers")
            or active_mission["product_name"].lower() in lower_msg
        )

        if is_for_active_mission and active_mission:
            updated_mission = run_mission_supplier_discovery(
                mission_id=active_mission["id"], user_id=user_id
            )
            returned_suppliers = updated_mission.get("suppliers") or []
            returned_requirements = updated_mission.get("requirements") or []
            returned_queries = updated_mission.get("search_queries") or []
            prod_label = updated_mission["product_name"]
            loc_label = updated_mission["preferred_sourcing_location"]
            action_taken = (
                f"Executed Upstream B2B Supplier Discovery for Mission '{updated_mission['mission_name']}' "
                f"({len(returned_suppliers)} suppliers)"
            )
        else:
            # Dynamic ad-hoc or product-specific live internet supplier search using the unified Supplier Discovery Service
            decomp = analyze_product_requirements({"prompt": message})
            constraints = decomp["extracted_constraints"]
            reqs = decomp["requirements"]
            disc = discover_suppliers_live(
                mission={**constraints, "user_id": user_id},
                product=constraints["product_name"],
                quantity=constraints["quantity"],
                requirements=reqs,
                target_budget=constraints["maximum_budget"],
                location=constraints["preferred_sourcing_location"],
                deadline=constraints["delivery_deadline"],
                certifications=constraints["certification_requirements"],
                max_results=6,
            )
            returned_suppliers = disc.get("suppliers") or []
            returned_requirements = disc.get("requirements") or []
            returned_queries = disc.get("search_queries") or []
            prod_label = disc.get("product") or constraints["product_name"]
            loc_label = disc.get("location") or constraints["preferred_sourcing_location"]
            action_taken = (
                f"Executed Upstream B2B Supplier Search for '{prod_label}' in {loc_label} "
                f"({len(returned_suppliers)} candidates)"
            )

            # Persist discovered live web suppliers in the global `suppliers` table
            now = utc_now_iso()
            with get_db() as conn:
                for sup in returned_suppliers:
                    upsert_supplier_record(conn, sup, now)

            record_audit_event(
                user_id=user_id,
                mission_id=active_mission["id"] if active_mission else None,
                actor="Vendra AI Chatbot",
                event_type="CHAT_LIVE_SUPPLIER_SEARCH",
                action=f"Live internet supplier search for {prod_label}",
                reason=f"Executed queries ({'; '.join(returned_queries[:3])}) -> {len(returned_suppliers)} live web suppliers.",
                input_reference=message[:90],
                output_reference=",".join(s["supplier_id"] for s in returned_suppliers[:5]),
                policy_decision="AUTO_EXECUTE",
                result="LIVE_WEB_SEARCH",
            )

        reply_text = (
            f"Completed upstream B2B supplier discovery for {prod_label} in {loc_label}.\n"
            f"Decomposed into {len(returned_requirements)} manufacturing requirements and executed {len(returned_queries)} B2B search queries.\n"
            f"Extracted {len(returned_suppliers)} verified upstream suppliers (raw material, component, packaging, and contract manufacturers) shown in the structured cards below."
        )

    # =========================================================================
    # INTENT 4: GENERATE_RFQS
    # =========================================================================
    elif intent == "GENERATE_RFQS":
        if not active_mission:
            reply_text = "You do not have an active mission yet. Tell me what product you want to manufacture (e.g., *'Create a mission for 1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit'*) and I will create the mission, discover live suppliers, and generate RFQs."
            action_taken = "Prompted user to create a mission first"
        else:
            updated_mission = run_mission_generate_rfqs(
                mission_id=active_mission["id"], user_id=user_id
            )
            rfqs = updated_mission.get("rfqs") or []
            returned_suppliers = updated_mission.get("suppliers") or []
            action_taken = f"Generated & Dispatched {len(rfqs)} RFQs for Mission '{updated_mission['mission_name']}'"
            rfq_lines = "\n".join(
                f"• **{r['supplier_name']}** — Status: `{r['status']}` | Qty: {r['quantity']:,} units | Target: {r['pricing_request']} | Deadline: ≤{r['delivery_deadline']} days"
                for r in rfqs[:5]
            )
            reply_text = (
                f"I have generated and dispatched **{len(rfqs)} commercial RFQs** for **{updated_mission['mission_name']}** "
                f"to verify unstated MOQ, unit pricing, lead times, and certifications:\n\n{rfq_lines}"
            )

    # =========================================================================
    # INTENT 5: DELAY_RECOVERY
    # =========================================================================
    elif intent == "DELAY_RECOVERY":
        if not active_mission:
            reply_text = "No active mission found to run supplier delay recovery on."
            action_taken = "No active mission"
        else:
            m_days = re.search(r"(\d+)\s*days?", message.lower())
            delay_days = (
                int(m_days.group(1))
                if m_days
                else max(int(active_mission.get("delivery_deadline") or 30) + 12, 42)
            )
            updated_mission = run_mission_supplier_delay_recovery(
                mission_id=active_mission["id"],
                user_id=user_id,
                payload={"lead_time_days": delay_days},
            )
            returned_suppliers = updated_mission.get("suppliers") or []
            risks = updated_mission.get("risks") or []
            approvals = updated_mission.get("approvals") or []
            pending_apr = next((a for a in approvals if a["status"] == "PENDING"), None)
            action_taken = f"Executed Supplier Failure Recovery ({delay_days}d delay) & Triggered Human Approval Gate"
            reply_text = (
                f"I detected a schedule constraint violation ({delay_days} days vs ≤{updated_mission['delivery_deadline']} days deadline) "
                f"on **{updated_mission['mission_name']}** and executed autonomous failure recovery.\n\n"
                + (
                    f"**Recommended Recovery Supplier (Pending Human Approval):**\n"
                    f"• **{pending_apr['supplier_name']}** ({pending_apr['location']}) — "
                    f"Unit Price: {format_inr(pending_apr['unit_price'])} | Total Landed Cost: **{format_inr(pending_apr['total_cost'])}** | "
                    f"Lead Time: **{pending_apr['lead_time_days']} days**\n"
                    f"• **Rationale:** {pending_apr['recommendation_rationale']}"
                    if pending_apr
                    else f"Recorded {len(risks)} risk alert(s) and updated alternative suppliers."
                )
            )

    # =========================================================================
    # INTENT 6: MISSION_ANALYSIS & OPERATIONAL Q&A
    # =========================================================================
    else:
        if active_mission:
            returned_suppliers = active_mission.get("suppliers") or []
            returned_requirements = active_mission.get("requirements") or []
            returned_queries = active_mission.get("search_queries") or []
            pending_apr = next(
                (a for a in (active_mission.get("approvals") or []) if a["status"] == "PENDING"),
                None,
            )
            open_risk = next(
                (r for r in (active_mission.get("risks") or []) if r["status"] == "OPEN"),
                None,
            )
            sup_summary = "\n".join(
                f"- {s.get('supplier_name') or s.get('name')} ({s.get('location')}): "
                f"Price={s.get('price_display')}, MOQ={s.get('moq_display')}, "
                f"LeadTime={s.get('lead_time_display')}, Source={s.get('source_domain')} ({s.get('source_url')}), "
                f"Status={s.get('eligibility_status')}"
                for s in returned_suppliers[:5]
            )
            context_block = (
                f"Active Mission: {active_mission['mission_name']} (ID: {active_mission['id']})\n"
                f"Product: {active_mission['product_name']} | Quantity: {active_mission['quantity']} units\n"
                f"Target Unit Cost: {format_inr(active_mission['target_unit_cost'])} | Max Budget: {format_inr(active_mission['maximum_budget'])}\n"
                f"Deadline: ≤{active_mission['delivery_deadline']} days | Location: {active_mission['preferred_sourcing_location']}\n"
                f"Current State: {active_mission['state']} | Discovery Mode: {active_mission.get('discovery_mode', 'LIVE_WEB_SEARCH')}\n"
                f"Decomposed Requirements: {', '.join(r['name'] for r in returned_requirements)}\n"
                f"Discovered Suppliers ({len(returned_suppliers)}):\n{sup_summary or 'None yet'}\n"
                f"RFQs Sent: {len(active_mission.get('rfqs') or [])}\n"
            )
            if open_risk:
                context_block += (
                    f"Open Supply Risk: {open_risk['what_changed']} (Failed: {open_risk['constraint_failed']}). "
                    f"Action: {open_risk['vendra_action']}\n"
                )
            if pending_apr:
                context_block += (
                    f"Pending Human Approval: {pending_apr['action']} with {pending_apr['supplier_name']} "
                    f"at {format_inr(pending_apr['unit_price'])}/unit (Total: {format_inr(pending_apr['total_cost'])}, "
                    f"Lead Time: {pending_apr['lead_time_days']}d). Rationale: {pending_apr['recommendation_rationale']}\n"
                )

            ai_reply = call_gemini_text(
                prompt=(
                    f"{context_block}\n"
                    f"User Question: {message}\n\n"
                    "Answer clearly and concisely using ONLY the real mission and supplier data above. "
                    "Never invent prices, MOQs, or lead times. All currency in INR (₹)."
                ),
                system_instruction=(
                    "You are the Vendra AI Sourcing Copilot connected to Vendra's live procurement backend. "
                    "Be factual, specific, and cite actual supplier names, source domains, and INR figures."
                ),
                timeout_sec=7.0,
            )
            if ai_reply:
                reply_text = ai_reply
            else:
                if pending_apr:
                    reply_text = (
                        f"Mission **{active_mission['mission_name']}** is in state `{active_mission['state']}` "
                        f"with a pending human approval for **{pending_apr['supplier_name']}** ({pending_apr['location']}) "
                        f"at **{format_inr(pending_apr['unit_price'])}/unit** (Total: **{format_inr(pending_apr['total_cost'])}**, "
                        f"Lead Time: **{pending_apr['lead_time_days']} days**).\n\n"
                        f"**Rationale:** {pending_apr['recommendation_rationale']}"
                    )
                elif returned_suppliers:
                    top_s = returned_suppliers[0]
                    reply_text = (
                        f"Mission **{active_mission['mission_name']}** (`{active_mission['state']}`) has "
                        f"**{len(returned_suppliers)} live web suppliers** discovered via `{active_mission.get('discovery_mode', 'LIVE_WEB_SEARCH')}`.\n\n"
                        f"Top candidate: **{top_s.get('supplier_name') or top_s.get('name')}** ({top_s.get('location')}) — "
                        f"Matched requirement: *{top_s.get('matched_requirement')}* | "
                        f"Price: **{top_s.get('price_display')}** | MOQ: **{top_s.get('moq_display')}** | "
                        f"Source: `{top_s.get('source_domain')}` ({top_s.get('source_url')})."
                    )
                else:
                    reply_text = (
                        f"Mission **{active_mission['mission_name']}** is currently in `{active_mission['state']}` stage "
                        f"for {active_mission['quantity']:,} units of {active_mission['product_name']} "
                        f"(Max Budget: {format_inr(active_mission['maximum_budget'])}, Deadline: ≤{active_mission['delivery_deadline']} days). "
                        "Ask me to **discover suppliers** to search the live internet for matching manufacturers."
                    )
            action_taken = f"Analyzed Mission '{active_mission['mission_name']}' ({active_mission['state']})"
        else:
            all_aprs = [a for a in list_user_approvals(user_id) if a["status"] == "PENDING"]
            all_risks = [r for r in list_mission_risks(user_id) if r["status"] == "OPEN"]
            reply_text = (
                f"You currently have **0 active missions**, **{len(all_aprs)} pending approvals**, and **{len(all_risks)} open supply risks**.\n\n"
                "You can ask me to:\n"
                "• **Search live suppliers** for any product or material (e.g., *'Find suppliers for 1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit'*)\n"
                "• **Decompose a product** into raw materials, components, packaging, and processes\n"
                "• **Create and launch a sourcing mission**"
            )
            action_taken = "Checked workspace status"

    assistant_metadata = {
        "action_taken": action_taken,
        "intent": intent,
        "mission_id": updated_mission["id"] if updated_mission else None,
        "mission_state": updated_mission["state"] if updated_mission else None,
        "discovery_mode": "LIVE_WEB_SEARCH" if returned_suppliers else (updated_mission.get("discovery_mode") if updated_mission else "LIVE_WEB_SEARCH"),
        "suppliers": returned_suppliers[:6],
        "requirements": returned_requirements[:6],
        "search_queries": returned_queries[:6],
    }

    assistant_msg_record = _save_chat_message(
        user_id=user_id,
        mission_id=updated_mission["id"] if updated_mission else mission_id,
        role="assistant",
        content=reply_text,
        intent=intent,
        metadata=assistant_metadata,
    )

    return {
        "reply": reply_text,
        "intent": intent,
        "action_taken": action_taken,
        "user_message": user_msg_record,
        "assistant_message": assistant_msg_record,
        "suppliers": returned_suppliers[:6],
        "requirements": returned_requirements[:6],
        "search_queries": returned_queries[:6],
        "mission": updated_mission,
    }
