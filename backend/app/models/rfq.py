"""
RFQ Model & Statuses (backend/app/models/rfq.py)
Implements all RFQ fields and statuses from Section 23.
"""
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Dict, Any, Optional


class RFQStatus(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    SENT = "SENT"
    PARTIALLY_RESPONDED = "PARTIALLY_RESPONDED"
    RESPONDED = "RESPONDED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


@dataclass
class RFQ:
    id: str
    mission_id: str
    user_id: str
    supplier_id: str
    supplier_name: str
    status: str
    product_requirements: str
    quantity: int
    material: str
    quality: str
    packaging: str
    certification: str
    delivery_deadline: int
    pricing_request: str
    moq_request: int
    lead_time_request: int
    payment_terms: str
    shipping_requirements: str
    rfq_body: str
    sent_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
