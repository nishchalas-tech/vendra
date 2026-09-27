"""
RFQ Generator Tool (backend/app/tools/rfq_generator.py)
Implements Section 23:
Drafts structured RFQs containing product requirements, quantity, material, quality,
packaging, certification, delivery deadline, pricing request, MOQ request, lead time,
payment terms, and shipping requirements in INR (₹).
"""
from pathlib import Path
from typing import Any, Dict
from app.integrations.gemini import call_gemini_text
from app.tools.cost_calculator import format_inr


def generate_rfq_document(mission: Dict[str, Any], supplier: Dict[str, Any]) -> Dict[str, Any]:
    qty = int(mission.get("quantity") or 1000)
    target_unit = float(mission.get("target_unit_cost") or 250.0)
    max_budget = float(mission.get("maximum_budget") or (qty * target_unit))
    deadline = int(mission.get("delivery_deadline") or 30)
    material = mission.get("material") or supplier.get("materials") or "Standard Food/Industrial Grade"
    quality = mission.get("quality_requirements") or "Pre-dispatch AQL 1.5 inspection & batch tolerance verification"
    packaging = mission.get("packaging_requirements") or supplier.get("packaging_capabilities") or "Recycled Kraft / Corrugated Master Cartons"
    certification = mission.get("certification_requirements") or "ISO 9001:2015, BIS / FSSAI where applicable"
    dest_location = mission.get("preferred_sourcing_location") or "Bengaluru, Karnataka"
    product_req = (
        f"{mission.get('product_name')} ({mission.get('product_category', 'Physical Product')}) — "
        f"{mission.get('product_description') or 'Manufactured to specification'}"
    )
    pricing_req = (
        f"Target landed unit price <= ₹{target_unit:.0f}/unit (Total budget ceiling {format_inr(max_budget)} INR inclusive of packaging & surface freight to {dest_location})."
    )
    payment_terms = supplier.get("payment_terms") or "30% Advance, 70% Pre-Dispatch upon Quality Inspection"
    shipping_req = f"Door delivery / surface freight to {dest_location} within {deadline} calendar days."

    # Optional Gemini enhancement for formal body prose
    prompt_path = Path(__file__).resolve().parents[1] / "prompts" / "rfq_generator.txt"
    sys_prompt = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""
    ai_body = call_gemini_text(
        prompt=(
            f"Supplier: {supplier.get('name')} ({supplier.get('location')})\n"
            f"Mission: {mission.get('mission_name')}\n"
            f"Product: {product_req}\n"
            f"Quantity: {qty} units\n"
            f"Material: {material}\n"
            f"Quality: {quality}\n"
            f"Packaging: {packaging}\n"
            f"Certifications: {certification}\n"
            f"Delivery Deadline: {deadline} days to {dest_location}\n"
            f"Target Pricing: {pricing_req}\n"
        ),
        system_instruction=sys_prompt,
        timeout_sec=5.0,
    )

    deterministic_body = (
        f"REQUEST FOR QUOTATION (RFQ)\n"
        f"To: {supplier.get('name')} — {supplier.get('location')}\n"
        f"Mission Reference: {mission.get('mission_name')}\n"
        f"------------------------------------------------------------\n"
        f"1. Product Requirements: {product_req}\n"
        f"2. Order Quantity: {qty:,} units (MOQ Requested: <= {qty:,} units)\n"
        f"3. Material Specification: {material}\n"
        f"4. Quality Standard: {quality}\n"
        f"5. Packaging Specification: {packaging}\n"
        f"6. Required Certifications: {certification}\n"
        f"7. Delivery Deadline: <= {deadline} days delivered to {dest_location}\n"
        f"8. Pricing Request (INR): {pricing_req}\n"
        f"9. Payment Terms Requested: {payment_terms}\n"
        f"10. Shipping & Logistics: {shipping_req}\n"
        f"------------------------------------------------------------\n"
        f"Please respond with itemized Ex-Works unit rate (₹), MOQ, confirmed lead time (days), "
        f"packaging & freight charges (₹), and valid certification copies."
    )

    return {
        "product_requirements": product_req,
        "quantity": qty,
        "material": material,
        "quality": quality,
        "packaging": packaging,
        "certification": certification,
        "delivery_deadline": deadline,
        "pricing_request": pricing_req,
        "moq_request": qty,
        "lead_time_request": deadline,
        "payment_terms": payment_terms,
        "shipping_requirements": shipping_req,
        "rfq_body": ai_body if ai_body else deterministic_body,
    }
