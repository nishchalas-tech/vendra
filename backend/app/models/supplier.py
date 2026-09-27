"""
Supplier Model (backend/app/models/supplier.py)
Implements all supplier fields from Section 22.
"""
from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class Supplier:
    supplier_id: str
    name: str
    location: str
    area: str
    city: str
    state: str
    manufacturing_capabilities: str
    materials: str
    minimum_order_quantity: int
    indicative_unit_price_inr: float
    lead_time_days: int
    certifications: str
    packaging_capabilities: str
    payment_terms: str
    shipping_regions: str
    reliability_score: float
    evidence: str
    demo_supplier: int = 1
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["demo_supplier"] = bool(self.demo_supplier)
        return d
