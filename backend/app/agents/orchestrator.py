"""
Mission Orchestrator (backend/app/agents/orchestrator.py)
Implements Section 6, Section 19, and Section 20:
- Single primary Mission Orchestrator (NEVER a swarm of 8 autonomous agents)
- Structured AgentDecision output validated via AgentDecision.model_validate()
- Policy Engine check before every tool execution
- Invalid Gemini output is never executed; recorded safely with deterministic fallback
"""
from pathlib import Path
from typing import Any, Dict, Optional
from backend.app.integrations.gemini import call_gemini_json
from backend.app.policy.engine import evaluate_policy
from backend.app.schemas.decision import AgentDecision
from backend.app.services.finance_service import record_audit_event


class MissionOrchestrator:
    """
    Single primary Mission Orchestrator coordinating tools, deterministic policy checks,
    and persistent mission state transitions.
    """

    def __init__(self) -> None:
        prompt_file = Path(__file__).resolve().parents[1] / "prompts" / "mission_orchestrator.txt"
        self.system_prompt = (
            prompt_file.read_text(encoding="utf-8") if prompt_file.exists() else ""
        )

    def decide_next_action(
        self,
        mission: Dict[str, Any],
        context_summary: str,
        default_decision_dict: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Proposes a structured AgentDecision (using Gemini when configured, validated strictly
        through AgentDecision.model_validate), runs it through the deterministic Policy Engine,
        and records an audit event if invalid output is encountered.
        """
        raw_ai = call_gemini_json(
            prompt=(
                f"Mission: {mission.get('mission_name')} ({mission.get('product_name')})\n"
                f"State: {mission.get('state')}\n"
                f"Quantity: {mission.get('quantity')} units | Target Unit Cost: ₹{mission.get('target_unit_cost')} | Max Budget: ₹{mission.get('maximum_budget')}\n"
                f"Deadline: {mission.get('delivery_deadline')} days | Location: {mission.get('preferred_sourcing_location')}\n"
                f"Context: {context_summary}\n"
                f"Return JSON matching AgentDecision fields: action_type, reason, tool_name, tool_arguments, risk_level, requires_human_approval, expected_outcome, constraints_checked, evidence_required."
            ),
            system_instruction=self.system_prompt,
            timeout_sec=5.0,
        )

        decision_obj: Optional[AgentDecision] = None
        if raw_ai is not None:
            try:
                decision_obj = AgentDecision.model_validate(raw_ai)
            except Exception as exc:
                # Section 20: If Gemini returns invalid output: DO NOT execute it. Record the failure.
                record_audit_event(
                    user_id=mission["user_id"],
                    mission_id=mission["id"],
                    actor="Mission Orchestrator",
                    event_type="AI_OUTPUT_VALIDATION_FAILED",
                    action="Rejected malformed LLM decision payload",
                    reason=f"Validation failed ({exc}); falling back to deterministic orchestrator rule.",
                    policy_decision="BLOCKED",
                    result="SAFE_FALLBACK",
                )

        if decision_obj is None:
            decision_obj = AgentDecision.model_validate(default_decision_dict)

        policy_result = evaluate_policy(
            action_type=decision_obj.action_type,
            tool_name=decision_obj.tool_name,
            payload=decision_obj.tool_arguments,
        )

        return {
            "decision": decision_obj.model_dump(),
            "policy": policy_result,
        }


orchestrator = MissionOrchestrator()
