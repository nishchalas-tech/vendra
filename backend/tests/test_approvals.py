"""
Human Approval & Rejection Tests (backend/tests/test_approvals.py)
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend


class TestApprovals(unittest.TestCase):
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
                "full_name": "Priya Hegde",
                "email": "priya@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers = {"Authorization": f"Bearer {data['token']}"}

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_rejection_stops_and_returns_to_recovery(self) -> None:
        _, m_res = dispatch_request(
            "POST",
            "/api/missions",
            self.headers,
            {
                "mission_name": "Bamboo Lunch Boxes",
                "product_name": "Bamboo Lunch Boxes",
                "quantity": 1000,
                "target_unit_cost": 200,
                "maximum_budget": 250000,
                "material": "Bamboo",
                "delivery_deadline": 30,
                "launch_immediately": True,
            },
        )
        mid = m_res["mission"]["id"]
        _, d_res = dispatch_request(
            "POST",
            f"/api/missions/{mid}/simulate-delay",
            self.headers,
            {"lead_time_days": 42},
        )
        apr_id = d_res["mission"]["approvals"][0]["id"]

        rej_code, rej_res = dispatch_request(
            "POST",
            f"/api/approvals/{apr_id}/reject",
            self.headers,
            {"decision_notes": "Prefer another supplier in Jigani."},
        )
        self.assertEqual(rej_code, 200)
        self.assertEqual(rej_res["approval"]["status"], "REJECTED")

        _, after_m = dispatch_request("GET", f"/api/missions/{mid}", self.headers)
        self.assertEqual(after_m["mission"]["state"], "RECOVERY_IN_PROGRESS")
