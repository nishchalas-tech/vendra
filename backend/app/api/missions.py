"""
Missions API Handlers (backend/app/api/missions.py)
"""
from typing import Any, Dict, Tuple
from backend.app.integrations.elevenlabs import (
    interpret_voice_command,
    is_elevenlabs_configured,
    synthesize_voice_response,
)
from backend.app.integrations.gemini import call_gemini_text
from backend.app.services.finance_service import record_audit_event
from backend.app.services.mission_service import (
    analyze_mission_requirements,
    cancel_mission,
    create_mission,
    get_mission_detail,
    launch_mission,
    list_user_missions,
    run_mission_generate_rfqs,
    run_mission_process_supplier_response,
    run_mission_supplier_delay_recovery,
    run_mission_supplier_discovery,
    update_mission,
    update_mission_requirements,
)
from backend.app.tools.cost_calculator import format_inr
from backend.app.tools.product_decomposition import analyze_product_requirements


def handle_analyze_product(
    _user: Dict[str, Any], payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        result = analyze_product_requirements(payload)
        return 200, result
    except Exception as exc:
        return 400, {"error": str(exc)}


def handle_analyze_mission_requirements(
    user: Dict[str, Any], mission_id: str
) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = analyze_mission_requirements(
            mission_id=mission_id, user_id=user["id"]
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_update_mission_requirements(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        reqs = payload.get("requirements") or []
        mission = update_mission_requirements(
            mission_id=mission_id, user_id=user["id"], requirements=reqs
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_list_missions(user: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    missions = list_user_missions(user["id"])
    return 200, {"missions": missions}


def handle_create_mission(user: Dict[str, Any], payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    try:
        launch = bool(payload.get("launch_immediately", False))
        mission = create_mission(
            user_id=user["id"],
            payload=payload,
            launch_immediately=launch,
            is_demo=bool(payload.get("is_demo", False)),
        )
        return 201, {"mission": mission}
    except ValueError as exc:
        return 400, {"error": str(exc)}


def handle_get_mission(user: Dict[str, Any], mission_id: str) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = get_mission_detail(mission_id=mission_id, user_id=user["id"])
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_update_mission(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = update_mission(
            mission_id=mission_id, user_id=user["id"], payload=payload
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_launch_mission(user: Dict[str, Any], mission_id: str) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = launch_mission(mission_id=mission_id, user_id=user["id"])
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_cancel_mission(user: Dict[str, Any], mission_id: str) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = cancel_mission(mission_id=mission_id, user_id=user["id"])
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_discover_suppliers(user: Dict[str, Any], mission_id: str) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = run_mission_supplier_discovery(mission_id=mission_id, user_id=user["id"])
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_generate_rfqs(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        supplier_ids = payload.get("supplier_ids")
        mission = run_mission_generate_rfqs(
            mission_id=mission_id, user_id=user["id"], supplier_ids=supplier_ids
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_process_response(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = run_mission_process_supplier_response(
            mission_id=mission_id, user_id=user["id"], payload=payload
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_simulate_delay(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    try:
        mission = run_mission_supplier_delay_recovery(
            mission_id=mission_id, user_id=user["id"], payload=payload
        )
        return 200, {"mission": mission}
    except ValueError as exc:
        return 404, {"error": str(exc)}


def handle_ask_vendra(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    """
    Implements 'Ask Vendra' on the Approval / Mission Workspace screen (Section 19 & 28):
    Explains why Vendra recommends a recovery option or current constraint state using actual persisted mission data.
    """
    try:
        mission = get_mission_detail(mission_id=mission_id, user_id=user["id"])
    except ValueError as exc:
        return 404, {"error": str(exc)}

    question = str(payload.get("question") or "Why does Vendra recommend this action?").strip()
    pending_apr = next(
        (a for a in mission["approvals"] if a["status"] == "PENDING"), None
    )
    open_risk = next((r for r in mission["risks"] if r["status"] == "OPEN"), None)

    context = (
        f"Mission: {mission['mission_name']} ({mission['product_name']}, {mission['quantity']} units, "
        f"Budget: {format_inr(mission['maximum_budget'])}, Deadline: {mission['delivery_deadline']} days, "
        f"State: {mission['state']}).\n"
    )
    if open_risk:
        context += (
            f"Active Risk: {open_risk['what_changed']} Constraint failed: {open_risk['constraint_failed']}. "
            f"Vendra action: {open_risk['vendra_action']}\n"
        )
    if pending_apr:
        context += (
            f"Pending Approval: {pending_apr['action']} with {pending_apr['supplier_name']} "
            f"({pending_apr['location']}) at ₹{pending_apr['unit_price']:.0f}/unit "
            f"(Total: {format_inr(pending_apr['total_cost'])}, Lead time: {pending_apr['lead_time_days']} days). "
            f"Rationale: {pending_apr['recommendation_rationale']}\n"
        )

    ai_answer = call_gemini_text(
        prompt=f"{context}\nFounder Question: {question}\nProvide a concise, factual explanation grounded strictly in the numbers above (in INR ₹).",
        system_instruction="You are the Vendra Mission Orchestrator. Answer clearly using only the verified mission data provided.",
        timeout_sec=5.0,
    )

    if not ai_answer:
        if pending_apr:
            ai_answer = (
                f"Vendra recommends {pending_apr['supplier_name']} ({pending_apr['location']}) because "
                f"{pending_apr['reason']} Their {pending_apr['lead_time_days']}-day lead time satisfies your "
                f"{mission['delivery_deadline']}-day deadline, and the landed total of {format_inr(pending_apr['total_cost'])} "
                f"remains within your {format_inr(mission['maximum_budget'])} maximum budget."
            )
        else:
            ai_answer = (
                f"Mission '{mission['mission_name']}' is currently in state {mission['state']} with "
                f"{len(mission['suppliers'])} shortlisted suppliers, {len(mission['rfqs'])} RFQs, "
                f"and {len(mission['risks'])} recorded risk events."
            )

    return 200, {"answer": ai_answer, "mission_state": mission["state"]}


def handle_voice_command(
    user: Dict[str, Any], mission_id: str, payload: Dict[str, Any]
) -> Tuple[int, Dict[str, Any]]:
    """
    Implements Section 32 (ElevenLabs Voice Interface):
    voice input -> interpretation -> structured command -> Mission Orchestrator -> Policy Engine -> action or approval -> voice response
    """
    try:
        mission = get_mission_detail(mission_id=mission_id, user_id=user["id"])
    except ValueError as exc:
        return 404, {"error": str(exc)}

    transcript = str(
        payload.get("transcript")
        or "Supplier B cannot deliver before next month. Find another supplier in Bengaluru under three lakh."
    ).strip()

    structured_cmd = interpret_voice_command(transcript=transcript, mission=mission)
    record_audit_event(
        user_id=user["id"],
        mission_id=mission_id,
        actor="Voice Interface",
        event_type="VOICE_COMMAND_INTERPRETED",
        action=f"Voice command interpreted: {structured_cmd['intent']}",
        reason=f'Transcript: "{transcript}"',
        input_reference=transcript[:80],
        output_reference=structured_cmd["intent"],
        policy_decision="AUTO_EXECUTE",
        result="INTERPRETED",
    )

    if structured_cmd["intent"] == "REPORT_SUPPLIER_DELAY_AND_RECOVER":
        updated_mission = run_mission_supplier_delay_recovery(
            mission_id=mission_id,
            user_id=user["id"],
            payload={"lead_time_days": structured_cmd.get("lead_time_days", 42)},
        )
        pending_apr = next(
            (a for a in updated_mission["approvals"] if a["status"] == "PENDING"), None
        )
        rec_count = len(updated_mission["risks"][0]["recovery_options"]) if updated_mission["risks"] else 2
        spoken_text = (
            f"Supplier B no longer satisfies the {updated_mission['delivery_deadline']}-day mission deadline. "
            f"I found {rec_count} Bengaluru and Karnataka alternatives within your {format_inr(updated_mission['maximum_budget'])} budget. "
            f"Human approval is required before selecting {pending_apr['supplier_name'] if pending_apr else 'an alternative supplier'}."
        )
    elif structured_cmd["intent"] == "DISCOVER_SUPPLIERS":
        updated_mission = run_mission_supplier_discovery(
            mission_id=mission_id, user_id=user["id"]
        )
        spoken_text = (
            f"Supplier discovery completed for {updated_mission['product_name']}. "
            f"Found {len(updated_mission['suppliers'])} matching suppliers in {updated_mission['preferred_sourcing_location']}."
        )
    elif structured_cmd["intent"] == "GENERATE_RFQ":
        updated_mission = run_mission_generate_rfqs(
            mission_id=mission_id, user_id=user["id"], supplier_ids=None
        )
        spoken_text = (
            f"Generated and dispatched {len(updated_mission['rfqs'])} RFQs. Mission is now waiting for supplier responses."
        )
    else:
        updated_mission = mission
        spoken_text = f"Mission {mission['mission_name']} is in {mission['state']} stage."

    audio_base64 = synthesize_voice_response(spoken_text)
    return 200, {
        "transcript": transcript,
        "structured_command": structured_cmd,
        "voice_response_text": spoken_text,
        "elevenlabs_configured": is_elevenlabs_configured(),
        "audio_base64": audio_base64,
        "mission": updated_mission,
    }
