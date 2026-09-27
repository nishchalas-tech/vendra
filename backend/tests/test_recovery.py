"""
Critical Recovery Workflow Test (backend/tests/test_recovery.py)
Implements Section 54 Critical Recovery Test:
Supplier B: 25 days -> Changed: 42 days | Mission: 30 days
Expected: constraint violation, risk, recovery, alternative suppliers, approval, resume, verification
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend


class TestCriticalSupplierRecovery(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        os.environ["VENDRA_SQLITE_PATH"] = self.tmp.name
        initialize_backend()
        _, data = dispatch_request(
            "POST",
            "/api/auth/signup",
            {},
            {
                "full_name": "Rohan Deshmukh",
                "email": "rohan@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers = {"Authorization": f"Bearer {data['token']}"}

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_hero_agentic_recovery_flow_end_to_end(self) -> None:
        # 1. Create and launch mission with 30-day deadline
        _, create_res = dispatch_request(
            "POST",
            "/api/missions",
            self.headers,
            {
                "mission_name": "Eco-Friendly Reusable Bottles",
                "product_name": "Eco-friendly reusable bottles",
                "quantity": 1000,
                "target_unit_cost": 300,
                "maximum_budget": 300000,
                "material": "SS 304 Steel & Bamboo",
                "preferred_sourcing_location": "Bengaluru, Karnataka",
                "delivery_deadline": 30,
                "launch_immediately": True,
            },
        )
        mission_id = create_res["mission"]["id"]

        # 2. Initial Supplier B response: 25 days (within 30-day deadline)
        _, resp_25 = dispatch_request(
            "POST",
            f"/api/missions/{mission_id}/process-response",
            self.headers,
            {
                "supplier_id": "sup_bommasandra_02",
                "unit_price": 248.0,
                "moq": 500,
                "lead_time_days": 25,
                "certifications": "ISO 9001:2015, BIS",
            },
        )
        self.assertTrue(resp_25["mission"]["supplier_responses"][0]["is_valid_all_constraints"])

        # 3. External event changes Supplier B lead time to 42 days (42 > 30 deadline)
        code_delay, delay_res = dispatch_request(
            "POST",
            "/api/webhooks/external-event",
            self.headers,
            {
                "mission_id": mission_id,
                "supplier_id": "sup_bommasandra_02",
                "event_type": "DELIVERY_DELAY",
                "message": "Delivery will now take 42 days.",
                "received_at": "2026-09-26T10:00:00Z",
            },
        )
        self.assertEqual(code_delay, 200)
        m_after = delay_res["mission"]

        # Verify risk, recovery alternatives, and pending human approval
        self.assertEqual(m_after["state"], "AWAITING_APPROVAL")
        self.assertGreaterEqual(len(m_after["risks"]), 1)
        risk = m_after["risks"][0]
        self.assertIn("42", risk["what_changed"])
        self.assertGreaterEqual(len(risk["recovery_options"]), 2)

        pending_approvals = [a for a in m_after["approvals"] if a["status"] == "PENDING"]
        self.assertEqual(len(pending_approvals), 1)
        approval_id = pending_approvals[0]["id"]

        # 4. Approve recovery supplier -> mission resumes, verifies constraints, and completes
        apr_code, _ = dispatch_request(
            "POST",
            f"/api/approvals/{approval_id}/approve",
            self.headers,
            {"decision_notes": "Approved Peenya backup supplier within 30-day deadline."},
        )
        self.assertEqual(apr_code, 200)

        # Verify mission state is COMPLETED and audit trail has complete history
        _, final_res = dispatch_request("GET", f"/api/missions/{mission_id}", self.headers)
        final_mission = final_res["mission"]
        self.assertEqual(final_mission["state"], "COMPLETED")
        event_types = [e["event_type"] for e in final_mission["audit_events"]]
        self.assertIn("EXTERNAL_EVENT_RECEIVED", event_types)
        self.assertIn("CONSTRAINT_CHECKED", event_types)
        self.assertIn("RECOVERY_STARTED", event_types)
        self.assertIn("APPROVAL_REQUESTED", event_types)
        self.assertIn("APPROVAL_GRANTED", event_types)
        self.assertIn("MISSION_RESUMED", event_types)
        self.assertIn("MISSION_VERIFIED", event_types)
        self.assertIn("MISSION_COMPLETED", event_types)
