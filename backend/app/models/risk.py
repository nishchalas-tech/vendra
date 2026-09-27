"""
Risk Model (backend/app/models/risk.py)
Implements structured Risk & Recovery fields from Section 42.
"""
from dataclasses import dataclass, asdict
import json
from typing import Dict, Any, Optional


@dataclass
class Risk:
    id: str
    mission_id: str
    user_id: str
    supplier_id: Optional[str]
    supplier_name: str
    risk_type: str
    severity: str
    status: str
    what_changed: str
    why_problem: str
    constraint_failed: str
    expected_value: str
    actual_value: str
    vendra_action: str
    recovery_options_json: str = "[]"
    requires_human_approval: int = 1
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["requires_human_approval"] = bool(self.requires_human_approval)
        try:
            d["recovery_options"] = json.loads(self.recovery_options_json or "[]")
        except Exception:
            d["recovery_options"] = []
        return d
