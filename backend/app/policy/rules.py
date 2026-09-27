"""
Deterministic Policy Rules (backend/app/policy/rules.py)
Implements Section 21:
AUTO_EXECUTE, HUMAN_APPROVAL, and BLOCKED action classifications.
Gemini never decides permissions; deterministic Python rules govern all actions.
"""
from enum import Enum
from typing import Set


class PolicyDecision(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"
    HUMAN_APPROVAL = "HUMAN_APPROVAL"
    BLOCKED = "BLOCKED"


AUTO_EXECUTE_ACTIONS: Set[str] = {
    "supplier_discovery",
    "supplier_filtering",
    "supplier_normalization",
    "rfq_drafting",
    "rfq_send",
    "quote_parsing",
    "quote_comparison",
    "cost_calculations",
    "constraint_checks",
    "risk_detection",
    "alternative_discovery",
    "internal_status_updates",
    "audit_event_creation",
    "mission_verification",
}

HUMAN_APPROVAL_ACTIONS: Set[str] = {
    "final_supplier_selection",
    "purchase_order",
    "payment",
    "supplier_commitment",
    "major_budget_changes",
    "major_deadline_changes",
    "contract_acceptance",
    "high_value_procurement",
    "irreversible_external_action",
    "recovery_supplier_switch",
}

BLOCKED_ACTIONS: Set[str] = {
    "fabricated_evidence",
    "fabricated_certifications",
    "invented_supplier_capability",
    "invented_pricing_presented_as_verified",
    "autonomous_legal_commitment",
    "unauthorized_financial_action",
}
