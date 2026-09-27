"""
Deterministic Cost Calculator Tool (backend/app/tools/cost_calculator.py)
Implements Section 25:
Calculates unit cost, quantity, manufacturing cost, packaging, shipping, other known costs,
landed cost per unit, total procurement cost, and budget variance in INR (₹).
Never uses Gemini for financial arithmetic.
"""
from typing import Any, Dict, Optional


def format_inr(amount: float) -> str:
    """
    Formats a numeric value into Indian numbering system currency string (e.g. ₹2,75,000).
    """
    is_neg = amount < 0
    val = round(abs(float(amount)))
    s = str(val)
    if len(s) <= 3:
        formatted = s
    else:
        last_three = s[-3:]
        remaining = s[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted = ",".join(groups) + "," + last_three
    return f"-₹{formatted}" if is_neg else f"₹{formatted}"


def calculate_procurement_cost(
    unit_cost: Optional[float],
    quantity: int,
    maximum_budget: float,
    target_unit_cost: float,
    packaging_cost_inr: Optional[float] = None,
    shipping_cost_inr: Optional[float] = None,
    other_costs_inr: Optional[float] = None,
) -> Dict[str, Any]:
    if unit_cost is None or quantity <= 0:
        return {
            "currency": "INR",
            "complete": False,
            "unit_cost": unit_cost,
            "quantity": quantity,
            "manufacturing_cost": None,
            "packaging": packaging_cost_inr,
            "shipping": shipping_cost_inr,
            "other_known_costs": other_costs_inr,
            "landed_cost": None,
            "total_procurement_cost": None,
            "budget_variance": None,
            "formatted_total": "Unknown",
        }

    u_cost = float(unit_cost)
    qty = int(quantity)
    manufacturing_cost = round(u_cost * qty, 2)

    # Default realistic Indian B2B packaging & surface freight if not separately itemized
    packaging = round(float(packaging_cost_inr), 2) if packaging_cost_inr is not None else round(qty * 8.0, 2)
    shipping = round(float(shipping_cost_inr), 2) if shipping_cost_inr is not None else round(max(2500.0, qty * 4.5), 2)
    other_known = round(float(other_costs_inr), 2) if other_costs_inr is not None else 0.0

    total_procurement_cost = round(manufacturing_cost + packaging + shipping + other_known, 2)
    landed_cost = round(total_procurement_cost / qty, 2)
    budget_variance = round(float(maximum_budget) - total_procurement_cost, 2)
    unit_cost_variance = round(float(target_unit_cost) - landed_cost, 2)

    return {
        "currency": "INR",
        "complete": True,
        "unit_cost": u_cost,
        "quantity": qty,
        "manufacturing_cost": manufacturing_cost,
        "packaging": packaging,
        "shipping": shipping,
        "other_known_costs": other_known,
        "landed_cost": landed_cost,
        "total_procurement_cost": total_procurement_cost,
        "maximum_budget": float(maximum_budget),
        "target_unit_cost": float(target_unit_cost),
        "budget_variance": budget_variance,
        "unit_cost_variance": unit_cost_variance,
        "within_budget": total_procurement_cost <= float(maximum_budget),
        "within_target_unit_cost": landed_cost <= float(target_unit_cost),
        "formatted_total": format_inr(total_procurement_cost),
        "formatted_landed_unit": f"₹{landed_cost:.2f}/unit",
        "formatted_budget_variance": format_inr(budget_variance),
    }
