"""
Approval Model & Statuses (backend/app/models/approval.py)
Implements all Human Approval fields and statuses from Section 28.
"""
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Dict, Any, Optional


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


@dataclass
class Approval:
    id: str
    mission_id: str
    user_id: str
    action: str
    reason: str
    supplier_id: Optional[str] = None
    supplier_name: str = ""
    location: str = ""
    quantity: int = 0
    unit_price: float = 0.0
    total_cost: float = 0.0
    lead_time_days: int = 0
    certification: str = ""
    risk_summary: str = ""
    evidence: str = "Illustrative demo data"
    recommendation_rationale: str = ""
    status: str = ApprovalStatus.PENDING.value
    requested_at: str = ""
    approved_at: Optional[str] = None
    rejected_at: Optional[str] = None
    decision_notes: str = ""
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
