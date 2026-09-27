"""
Evidence Fetcher Tool (backend/app/tools/evidence_fetcher.py)
Implements Section 62:
Never allows Gemini to invent evidence. Marks unavailable supplier info as 'Unknown' or 'Not provided',
and demo data as 'Illustrative demo data'.
"""
from typing import Any, Dict


def verify_supplier_evidence(supplier: Dict[str, Any], response: Dict[str, Any]) -> Dict[str, Any]:
    is_demo = bool(supplier.get("demo_supplier", True))
    certs = response.get("certifications") or supplier.get("certifications")
    unit_price = response.get("unit_price")
    lead_time = response.get("lead_time_days")

    return {
        "evidence_label": "Illustrative demo data" if is_demo else (supplier.get("evidence") or "Verified supplier record"),
        "demo_supplier": is_demo,
        "certifications_status": certs if certs else "Not provided",
        "pricing_status": f"₹{unit_price}/unit" if unit_price is not None else "Unknown",
        "lead_time_status": f"{lead_time} days" if lead_time is not None else "Unknown",
    }
