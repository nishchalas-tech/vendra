"""
Deterministic Cost Engine & Constraint Engine Tests (backend/tests/test_constraints.py)
"""
import unittest
from app.tools.constraint_checker import check_mission_constraints
from app.tools.cost_calculator import calculate_procurement_cost, format_inr


class TestCostAndConstraints(unittest.TestCase):
    def test_indian_currency_formatting_and_cost_calculation(self) -> None:
        self.assertEqual(format_inr(275000), "₹2,75,000")
        self.assertEqual(format_inr(500000), "₹5,00,000")

        cost = calculate_procurement_cost(
            unit_cost=248.0,
            quantity=1000,
            maximum_budget=300000.0,
            target_unit_cost=300.0,
            packaging_cost_inr=8000.0,
            shipping_cost_inr=4500.0,
        )
        self.assertTrue(cost["complete"])
        self.assertEqual(cost["manufacturing_cost"], 248000.0)
        self.assertEqual(cost["total_procurement_cost"], 260500.0)
        self.assertEqual(cost["landed_cost"], 260.5)
        self.assertEqual(cost["budget_variance"], 39500.0)
        self.assertTrue(cost["within_budget"])

    def test_constraint_violation_detection(self) -> None:
        mission = {
            "quantity": 1000,
            "maximum_budget": 300000.0,
            "target_unit_cost": 300.0,
            "delivery_deadline": 30,
            "certification_requirements": "ISO 9001",
            "preferred_sourcing_location": "Bengaluru",
        }
        cost = calculate_procurement_cost(
            unit_cost=248.0,
            quantity=1000,
            maximum_budget=300000.0,
            target_unit_cost=300.0,
        )
        # Lead time 42 days > 30 days deadline -> VIOLATED
        eval_res = check_mission_constraints(
            mission=mission,
            response_data={
                "unit_price": 248.0,
                "moq": 500,
                "lead_time_days": 42,
                "certifications": "ISO 9001:2015",
            },
            cost_breakdown=cost,
            supplier_location="Bommasandra, Bengaluru",
        )
        self.assertFalse(eval_res["all_passed"])
        self.assertEqual(eval_res["violation_count"], 1)
        self.assertEqual(eval_res["violations"][0]["constraint"], "lead time <= deadline")
        self.assertEqual(eval_res["violations"][0]["status"], "VIOLATED")
