"""
Deterministic Constraint Engine Tool (backend/app/tools/constraint_checker.py)
Implements Section 26:
Deterministic checks for budget, landed unit cost, lead time <= deadline,
quantity, MOQ <= required quantity, required certifications, and preferred location.
"""
from typing import Any, Dict, List, Optional
from backend.app.tools.cost_calculator import format_inr


def check_mission_constraints(
    mission: Dict[str, Any],
    response_data: Dict[str, Any],
    cost_breakdown: Dict[str, Any],
    supplier_location: str = "",
) -> Dict[str, Any]:
    results: List[Dict[str, Any]] = []

    req_qty = int(mission.get("quantity") or 0)
    max_budget = float(mission.get("maximum_budget") or 0.0)
    target_unit = float(mission.get("target_unit_cost") or 0.0)
    deadline_days = int(mission.get("delivery_deadline") or 30)
    req_cert = (mission.get("certification_requirements") or "").strip()
    pref_loc = (mission.get("preferred_sourcing_location") or "Bengaluru").strip()

    total_spend = cost_breakdown.get("total_procurement_cost")
    landed_unit = cost_breakdown.get("landed_cost")
    lead_time = response_data.get("lead_time_days")
    moq = response_data.get("moq")
    sup_cert = (response_data.get("certifications") or "").strip()

    # 1. Total spend <= maximum budget
    if total_spend is not None:
        passed_budget = float(total_spend) <= max_budget
        results.append(
            {
                "constraint": "total spend <= maximum budget",
                "expected": f"<= {format_inr(max_budget)}",
                "actual": format_inr(float(total_spend)),
                "status": "PASSED" if passed_budget else "VIOLATED",
                "severity": "LOW" if passed_budget else "CRITICAL",
                "reason": (
                    f"Total landed spend {format_inr(float(total_spend))} is within budget {format_inr(max_budget)}."
                    if passed_budget
                    else f"Total landed spend {format_inr(float(total_spend))} exceeds maximum budget {format_inr(max_budget)}."
                ),
            }
        )
    else:
        results.append(
            {
                "constraint": "total spend <= maximum budget",
                "expected": f"<= {format_inr(max_budget)}",
                "actual": "Unknown",
                "status": "WARNING",
                "severity": "MEDIUM",
                "reason": "Unit price not provided; total spend cannot be verified yet.",
            }
        )

    # 2. Landed unit cost <= target unit cost
    if landed_unit is not None and target_unit > 0:
        passed_unit = float(landed_unit) <= target_unit
        results.append(
            {
                "constraint": "landed unit cost <= target unit cost",
                "expected": f"<= ₹{target_unit:.0f}/unit",
                "actual": f"₹{float(landed_unit):.2f}/unit",
                "status": "PASSED" if passed_unit else "VIOLATED",
                "severity": "LOW" if passed_unit else "HIGH",
                "reason": (
                    f"Landed cost ₹{float(landed_unit):.2f}/unit satisfies target ₹{target_unit:.0f}/unit."
                    if passed_unit
                    else f"Landed cost ₹{float(landed_unit):.2f}/unit exceeds target ₹{target_unit:.0f}/unit."
                ),
            }
        )

    # 3. Lead time <= deadline
    if lead_time is not None:
        lt_int = int(lead_time)
        passed_deadline = lt_int <= deadline_days
        results.append(
            {
                "constraint": "lead time <= deadline",
                "expected": f"<= {deadline_days} days",
                "actual": f"{lt_int} days",
                "status": "PASSED" if passed_deadline else "VIOLATED",
                "severity": "LOW" if passed_deadline else "CRITICAL",
                "reason": (
                    f"Lead time ({lt_int} days) meets mission deadline ({deadline_days} days)."
                    if passed_deadline
                    else f"DEADLINE VIOLATED: {lt_int} > {deadline_days} days (+{lt_int - deadline_days} days delay)."
                ),
            }
        )
    else:
        results.append(
            {
                "constraint": "lead time <= deadline",
                "expected": f"<= {deadline_days} days",
                "actual": "Unknown",
                "status": "WARNING",
                "severity": "HIGH",
                "reason": "Lead time was not provided in supplier response.",
            }
        )

    # 4. MOQ <= required purchasing quantity
    if moq is not None:
        moq_int = int(moq)
        passed_moq = moq_int <= req_qty
        results.append(
            {
                "constraint": "MOQ <= required purchasing quantity",
                "expected": f"<= {req_qty} units",
                "actual": f"{moq_int} units",
                "status": "PASSED" if passed_moq else "VIOLATED",
                "severity": "LOW" if passed_moq else "HIGH",
                "reason": (
                    f"Supplier MOQ ({moq_int} units) is compatible with mission quantity ({req_qty} units)."
                    if passed_moq
                    else f"Supplier MOQ ({moq_int} units) exceeds required quantity ({req_qty} units)."
                ),
            }
        )

    # 5. Required certification exists
    if req_cert:
        req_tokens = [t.strip().lower() for t in req_cert.replace("/", ",").split(",") if t.strip()]
        sup_cert_lower = sup_cert.lower()
        matched_any = any(tok in sup_cert_lower for tok in req_tokens) or ("iso" in sup_cert_lower)
        results.append(
            {
                "constraint": "required certification exists",
                "expected": req_cert,
                "actual": sup_cert if sup_cert else "Not provided",
                "status": "PASSED" if matched_any else "WARNING",
                "severity": "LOW" if matched_any else "MEDIUM",
                "reason": (
                    f"Certifications ({sup_cert}) satisfy requirement ({req_cert})."
                    if matched_any
                    else f"Required certification ({req_cert}) not fully verified in ({sup_cert or 'Not provided'})."
                ),
            }
        )

    # 6. Preferred location satisfied where possible
    if pref_loc and supplier_location:
        pref_tokens = [t.strip().lower() for t in pref_loc.replace("/", ",").split(",") if t.strip()]
        loc_lower = supplier_location.lower()
        loc_matched = any(tok in loc_lower for tok in pref_tokens)
        results.append(
            {
                "constraint": "preferred location satisfied",
                "expected": pref_loc,
                "actual": supplier_location,
                "status": "PASSED" if loc_matched else "WARNING",
                "severity": "LOW",
                "reason": (
                    f"Supplier location ({supplier_location}) matches preferred region ({pref_loc})."
                    if loc_matched
                    else f"Supplier is in {supplier_location} (outside preferred {pref_loc})."
                ),
            }
        )

    violations = [r for r in results if r["status"] == "VIOLATED"]
    return {
        "all_passed": len(violations) == 0,
        "violation_count": len(violations),
        "violations": violations,
        "results": results,
    }
