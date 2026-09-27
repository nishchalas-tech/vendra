"""
Deterministic Policy Engine (backend/app/policy/engine.py)
Evaluates any proposed action or AgentDecision against Vendra's deterministic governance rules.
"""
from typing import Any, Dict, Optional
from app.policy.rules import (
    AUTO_EXECUTE_ACTIONS,
    BLOCKED_ACTIONS,
    HUMAN_APPROVAL_ACTIONS,
    PolicyDecision,
)


def evaluate_policy(
    action_type: str,
    tool_name: str = "",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Deterministically evaluates whether an action is AUTO_EXECUTE, HUMAN_APPROVAL, or BLOCKED.
    """
    norm_action = (action_type or "").strip().lower()
    norm_tool = (tool_name or "").strip().lower()
    data = payload or {}

    # 1. Explicit BLOCKED checks (fabrication, unverified pricing presented as verified, autonomous legal/financial)
    if norm_action in BLOCKED_ACTIONS or norm_tool in BLOCKED_ACTIONS:
        return {
            "decision": PolicyDecision.BLOCKED.value,
            "allowed": False,
            "requires_human_approval": False,
            "reason": f"Action '{norm_action}' is strictly blocked by Vendra safety policy.",
        }

    if data.get("fabricated_evidence") or data.get("invented_certification") or data.get("invented_pricing"):
        return {
            "decision": PolicyDecision.BLOCKED.value,
            "allowed": False,
            "requires_human_approval": False,
            "reason": "Fabricated evidence, certifications, or invented pricing is blocked by policy.",
        }

    if data.get("autonomous_legal_commitment") or data.get("unauthorized_financial_action"):
        return {
            "decision": PolicyDecision.BLOCKED.value,
            "allowed": False,
            "requires_human_approval": False,
            "reason": "Autonomous legal or unauthorized financial commitment is blocked by policy.",
        }

    # 2. Explicit HUMAN_APPROVAL checks
    if norm_action in HUMAN_APPROVAL_ACTIONS or norm_tool in {
        "request_human_approval",
        "select_final_supplier",
        "issue_purchase_order",
        "execute_payment",
    }:
        return {
            "decision": PolicyDecision.HUMAN_APPROVAL.value,
            "allowed": True,
            "requires_human_approval": True,
            "reason": f"Action '{norm_action}' commits supplier selection, budget, or timeline and requires human approval.",
        }

    # 3. Explicit AUTO_EXECUTE checks
    if norm_action in AUTO_EXECUTE_ACTIONS or norm_tool in {
        "supplier_search",
        "supplier_lookup",
        "rfq_generator",
        "response_parser",
        "constraint_checker",
        "cost_calculator",
        "news_search",
        "evidence_fetcher",
        "risk_engine",
    }:
        return {
            "decision": PolicyDecision.AUTO_EXECUTE.value,
            "allowed": True,
            "requires_human_approval": False,
            "reason": f"Action '{norm_action}' is a safe analytical or operational step permitted for auto-execution.",
        }

    # Default conservative fallback: require human approval for unknown actions
    return {
        "decision": PolicyDecision.HUMAN_APPROVAL.value,
        "allowed": True,
        "requires_human_approval": True,
        "reason": f"Unclassified action '{norm_action}' defaults to human approval.",
    }
