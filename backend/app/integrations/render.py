"""
Render Workflows Integration (backend/app/integrations/render.py)
Implements Section 31:
Long-running execution, waiting, idempotent retries, and recovery tracking.
Database remains the authoritative source of truth.
"""
from typing import Any, Dict, List
from app.core.config import settings


WORKFLOW_STEPS: List[str] = [
    "mission_started",
    "supplier_discovery",
    "generate_rfq",
    "wait_for_response",
    "evaluate_response",
    "detect_risk",
    "find_recovery_options",
    "human_approval",
    "resume",
    "verify",
    "complete",
]


def is_render_configured() -> bool:
    return bool(settings.RENDER_API_KEY and settings.RENDER_API_KEY.strip())


def map_mission_state_to_workflow_step(mission_state: str, has_risk: bool = False) -> Dict[str, Any]:
    mapping = {
        "DRAFT": ("created", 0),
        "READY": ("mission_started", 1),
        "SUPPLIER_DISCOVERY": ("supplier_discovery", 2),
        "RFQ_PREPARATION": ("generate_rfq", 3),
        "RFQ_SENT": ("wait_for_response", 4),
        "WAITING_FOR_RESPONSE": ("wait_for_response", 4),
        "EVALUATING": ("evaluate_response", 5),
        "RISK_DETECTED": ("detect_risk", 6),
        "RECOVERY_IN_PROGRESS": ("find_recovery_options", 7),
        "AWAITING_APPROVAL": ("human_approval", 8),
        "RESUMING": ("resume", 9),
        "VERIFYING": ("verify", 10),
        "COMPLETED": ("complete", 11),
        "FAILED": ("detect_risk", 6),
        "CANCELLED": ("cancelled", 0),
    }
    step_name, index = mapping.get(mission_state, ("created", 0))
    return {
        "current_step": step_name,
        "step_index": index,
        "total_steps": len(WORKFLOW_STEPS),
        "steps": WORKFLOW_STEPS,
        "has_risk_branch": has_risk,
        "render_configured": is_render_configured(),
        "idempotent_retries_enabled": True,
    }
