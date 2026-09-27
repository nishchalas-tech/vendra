"""
Mission Model & States (backend/app/models/mission.py)
Implements all 15 backend mission states from Section 18.
"""
from dataclasses import dataclass, asdict
from enum import Enum
import json
from typing import Dict, Any, Optional


class MissionState(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    SUPPLIER_DISCOVERY = "SUPPLIER_DISCOVERY"
    RFQ_PREPARATION = "RFQ_PREPARATION"
    RFQ_SENT = "RFQ_SENT"
    WAITING_FOR_RESPONSE = "WAITING_FOR_RESPONSE"
    EVALUATING = "EVALUATING"
    RISK_DETECTED = "RISK_DETECTED"
    RECOVERY_IN_PROGRESS = "RECOVERY_IN_PROGRESS"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    RESUMING = "RESUMING"
    VERIFYING = "VERIFYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


VALID_MISSION_STATES = {s.value for s in MissionState}


@dataclass
class Mission:
    id: str
    user_id: str
    mission_name: str
    product_name: str
    product_description: str
    product_category: str
    quantity: int
    target_unit_cost: float
    maximum_budget: float
    material: str
    quality_requirements: str
    packaging_requirements: str
    certification_requirements: str
    preferred_sourcing_location: str
    delivery_deadline: int
    additional_requirements: str
    state: str = MissionState.DRAFT.value
    selected_supplier_id: Optional[str] = None
    is_demo: int = 0
    workflow_state_json: str = "{}"
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["is_demo"] = bool(self.is_demo)
        try:
            d["workflow_state"] = json.loads(self.workflow_state_json or "{}")
        except Exception:
            d["workflow_state"] = {}
        return d
