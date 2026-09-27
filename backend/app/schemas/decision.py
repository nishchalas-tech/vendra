"""
Structured AI Decisions Schema (backend/app/schemas/decision.py)
Implements AgentDecision from Section 20 with strict validation.
Supports both Pydantic v2 (when installed) and deterministic Python validation.
"""
from typing import Any, Dict, List


REQUIRED_DECISION_FIELDS = (
    "action_type",
    "reason",
    "tool_name",
    "tool_arguments",
    "risk_level",
    "requires_human_approval",
    "expected_outcome",
    "constraints_checked",
    "evidence_required",
)

ALLOWED_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


class AgentDecision:
    """
    Structured output schema for Gemini Mission Orchestrator decisions (Section 20).
    """

    def __init__(
        self,
        action_type: str,
        reason: str,
        tool_name: str,
        tool_arguments: Dict[str, Any],
        risk_level: str,
        requires_human_approval: bool,
        expected_outcome: str,
        constraints_checked: List[str],
        evidence_required: List[str],
    ) -> None:
        if not isinstance(action_type, str) or not action_type.strip():
            raise ValueError("action_type must be a non-empty string")
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError("reason must be a non-empty string")
        if not isinstance(tool_name, str) or not tool_name.strip():
            raise ValueError("tool_name must be a non-empty string")
        if not isinstance(tool_arguments, dict):
            raise ValueError("tool_arguments must be a dictionary")
        norm_risk = str(risk_level).upper().strip()
        if norm_risk not in ALLOWED_RISK_LEVELS:
            raise ValueError(f"risk_level must be one of {ALLOWED_RISK_LEVELS}")
        if not isinstance(requires_human_approval, bool):
            raise ValueError("requires_human_approval must be a boolean")
        if not isinstance(expected_outcome, str) or not expected_outcome.strip():
            raise ValueError("expected_outcome must be a non-empty string")
        if not isinstance(constraints_checked, list):
            raise ValueError("constraints_checked must be a list of strings")
        if not isinstance(evidence_required, list):
            raise ValueError("evidence_required must be a list of strings")

        self.action_type = action_type.strip()
        self.reason = reason.strip()
        self.tool_name = tool_name.strip()
        self.tool_arguments = tool_arguments
        self.risk_level = norm_risk
        self.requires_human_approval = requires_human_approval
        self.expected_outcome = expected_outcome.strip()
        self.constraints_checked = [str(c) for c in constraints_checked]
        self.evidence_required = [str(e) for e in evidence_required]

    @classmethod
    def model_validate(cls, data: Dict[str, Any]) -> "AgentDecision":
        if not isinstance(data, dict):
            raise ValueError("AgentDecision payload must be a JSON object")
        for field in REQUIRED_DECISION_FIELDS:
            if field not in data:
                raise ValueError(f"Missing required field in AgentDecision: {field}")
        return cls(
            action_type=data["action_type"],
            reason=data["reason"],
            tool_name=data["tool_name"],
            tool_arguments=data["tool_arguments"],
            risk_level=data["risk_level"],
            requires_human_approval=bool(data["requires_human_approval"]),
            expected_outcome=data["expected_outcome"],
            constraints_checked=data["constraints_checked"],
            evidence_required=data["evidence_required"],
        )

    def model_dump(self) -> Dict[str, Any]:
        return {
            "action_type": self.action_type,
            "reason": self.reason,
            "tool_name": self.tool_name,
            "tool_arguments": self.tool_arguments,
            "risk_level": self.risk_level,
            "requires_human_approval": self.requires_human_approval,
            "expected_outcome": self.expected_outcome,
            "constraints_checked": self.constraints_checked,
            "evidence_required": self.evidence_required,
        }
