"""
SupplierResponse Model (backend/app/models/supplier_response.py)
Implements structured supplier response fields from Section 24.
Missing values remain None (null / unknown).
"""
from dataclasses import dataclass, asdict
import json
from typing import Dict, Any, Optional


@dataclass
class SupplierResponse:
    id: str
    mission_id: str
    rfq_id: Optional[str]
    supplier_id: str
    supplier_name: str
    raw_message: str = ""
    unit_price: Optional[float] = None
    moq: Optional[int] = None
    lead_time_days: Optional[int] = None
    material: Optional[str] = None
    certifications: Optional[str] = None
    packaging: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_cost_inr: Optional[float] = None
    packaging_cost_inr: Optional[float] = None
    other_costs_inr: Optional[float] = None
    notes: Optional[str] = None
    evidence: str = "Illustrative demo data"
    cost_breakdown_json: str = "{}"
    constraint_results_json: str = "[]"
    is_valid_all_constraints: int = 0
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["is_valid_all_constraints"] = bool(self.is_valid_all_constraints)
        try:
            d["cost_breakdown"] = json.loads(self.cost_breakdown_json or "{}")
        except Exception:
            d["cost_breakdown"] = {}
        try:
            d["constraint_results"] = json.loads(self.constraint_results_json or "[]")
        except Exception:
            d["constraint_results"] = []
        return d
