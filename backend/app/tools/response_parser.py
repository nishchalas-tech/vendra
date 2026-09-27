"""
Supplier Response Parser Tool (backend/app/tools/response_parser.py)
Implements Section 24 & Section 62:
Parses structured or unstructured supplier responses into structured fields.
CRITICAL RULE: Missing information must remain None (null / unknown).
Never invent missing values.
"""
import re
from typing import Any, Dict, Optional


def parse_supplier_response_payload(
    payload: Dict[str, Any],
    is_demo: bool = True,
) -> Dict[str, Any]:
    """
    Extracts structured fields from a supplier response payload or raw message.
    Leaves any unprovided field strictly as None (null / unknown).
    """
    raw_msg = str(payload.get("raw_message") or payload.get("message") or "").strip()

    unit_price: Optional[float] = payload.get("unit_price")
    moq: Optional[int] = payload.get("moq")
    lead_time_days: Optional[int] = payload.get("lead_time_days") or payload.get("lead_time")
    material: Optional[str] = payload.get("material")
    certifications: Optional[str] = payload.get("certifications")
    packaging: Optional[str] = payload.get("packaging")
    payment_terms: Optional[str] = payload.get("payment_terms")
    shipping_cost_inr: Optional[float] = payload.get("shipping_cost_inr") or payload.get("shipping")
    packaging_cost_inr: Optional[float] = payload.get("packaging_cost_inr")
    other_costs_inr: Optional[float] = payload.get("other_costs_inr")
    notes: Optional[str] = payload.get("notes") or (raw_msg if raw_msg else None)

    # Deterministic regex extraction from raw_message ONLY if explicitly stated in text
    if raw_msg:
        if unit_price is None:
            m_price = re.search(r"(?:₹|inr|rs\.?\s*)\s*(\d+(?:\.\d+)?)\s*(?:/\s*unit|per\s*unit)", raw_msg, re.I)
            if m_price:
                unit_price = float(m_price.group(1))
        if lead_time_days is None:
            m_days = re.search(r"(\d+)\s*days?", raw_msg, re.I)
            if m_days:
                lead_time_days = int(m_days.group(1))
        if moq is None:
            m_moq = re.search(r"moq\s*(?:of|:|=)?\s*(\d+)", raw_msg, re.I)
            if m_moq:
                moq = int(m_moq.group(1))

    evidence = payload.get("evidence")
    if not evidence:
        evidence = "Illustrative demo data" if is_demo else "Supplier quote submission"

    return {
        "raw_message": raw_msg,
        "unit_price": float(unit_price) if unit_price is not None else None,
        "moq": int(moq) if moq is not None else None,
        "lead_time_days": int(lead_time_days) if lead_time_days is not None else None,
        "material": str(material).strip() if material else None,
        "certifications": str(certifications).strip() if certifications else None,
        "packaging": str(packaging).strip() if packaging else None,
        "payment_terms": str(payment_terms).strip() if payment_terms else None,
        "shipping_cost_inr": float(shipping_cost_inr) if shipping_cost_inr is not None else None,
        "packaging_cost_inr": float(packaging_cost_inr) if packaging_cost_inr is not None else None,
        "other_costs_inr": float(other_costs_inr) if other_costs_inr is not None else None,
        "notes": str(notes).strip() if notes else None,
        "evidence": str(evidence),
    }
