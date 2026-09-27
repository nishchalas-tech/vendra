"""
Deterministic Policy Engine & Structured AgentDecision Tests (backend/tests/test_policy.py)
"""
import unittest
from backend.app.policy.engine import evaluate_policy
from backend.app.schemas.decision import AgentDecision


class TestPolicyAndDecisions(unittest.TestCase):
    def test_policy_engine_decisions(self) -> None:
        # AUTO_EXECUTE
        res_auto = evaluate_policy("supplier_discovery", "supplier_search")
        self.assertEqual(res_auto["decision"], "AUTO_EXECUTE")
        self.assertTrue(res_auto["allowed"])
        self.assertFalse(res_auto["requires_human_approval"])

        # HUMAN_APPROVAL
        res_human = evaluate_policy("final_supplier_selection", "request_human_approval")
        self.assertEqual(res_human["decision"], "HUMAN_APPROVAL")
        self.assertTrue(res_human["allowed"])
        self.assertTrue(res_human["requires_human_approval"])

        # BLOCKED
        res_blocked = evaluate_policy("fabricated_evidence")
        self.assertEqual(res_blocked["decision"], "BLOCKED")
        self.assertFalse(res_blocked["allowed"])

    def test_agent_decision_validation_rejects_invalid_payload(self) -> None:
        with self.assertRaises(ValueError):
            AgentDecision.model_validate({"action_type": "supplier_discovery"})
