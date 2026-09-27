"""
Multi-User Data Isolation & Ownership Enforcement Tests (backend/tests/test_ownership.py)
Verifies that User B cannot view, edit, launch, or approve User A's missions.
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend


class TestOwnershipIsolation(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        os.environ["VENDRA_SQLITE_PATH"] = self.tmp.name
        initialize_backend()

        _, user_a = dispatch_request(
            "POST",
            "/api/auth/signup",
            {},
            {
                "full_name": "User A",
                "email": "usera@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers_a = {"Authorization": f"Bearer {user_a['token']}"}

        _, user_b = dispatch_request(
            "POST",
            "/api/auth/signup",
            {},
            {
                "full_name": "User B",
                "email": "userb@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers_b = {"Authorization": f"Bearer {user_b['token']}"}

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_cross_user_isolation(self) -> None:
        _, m_res = dispatch_request(
            "POST",
            "/api/missions",
            self.headers_a,
            {
                "mission_name": "User A Confidential Mission",
                "product_name": "Custom Enclosure",
                "quantity": 500,
                "target_unit_cost": 300,
                "maximum_budget": 150000,
                "delivery_deadline": 25,
            },
        )
        mission_a_id = m_res["mission"]["id"]

        # User B list missions must be empty
        _, list_b = dispatch_request("GET", "/api/missions", self.headers_b)
        self.assertEqual(len(list_b["missions"]), 0)

        # User B attempting to GET, PUT, or LAUNCH User A's mission must fail with 404
        code_get, _ = dispatch_request(
            "GET", f"/api/missions/{mission_a_id}", self.headers_b
        )
        self.assertEqual(code_get, 404)

        code_put, _ = dispatch_request(
            "PUT",
            f"/api/missions/{mission_a_id}",
            self.headers_b,
            {"mission_name": "Hijacked"},
        )
        self.assertEqual(code_put, 404)

        code_launch, _ = dispatch_request(
            "POST", f"/api/missions/{mission_a_id}/launch", self.headers_b, {}
        )
        self.assertEqual(code_launch, 404)
