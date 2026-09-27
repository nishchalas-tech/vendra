"""
Mission Creation, Editing, Multiple Missions, Draft Persistence, and Launch Tests (backend/tests/test_missions.py)
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend


class TestMissions(unittest.TestCase):
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
                "full_name": "Aarav Kulkarni",
                "email": "aarav@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers = {"Authorization": f"Bearer {data['token']}"}

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_zero_initial_missions_and_multiple_independent_missions(self) -> None:
        # Brand new user must have zero missions (no automatic demo mission)
        code, listing = dispatch_request("GET", "/api/missions", self.headers)
        self.assertEqual(code, 200)
        self.assertEqual(len(listing["missions"]), 0)

        # Create Mission A as DRAFT (Bamboo Lunch Box Production)
        code_a, res_a = dispatch_request(
            "POST",
            "/api/missions",
            self.headers,
            {
                "mission_name": "Bamboo Lunch Box Production",
                "product_name": "Bamboo Lunch Boxes",
                "quantity": 2000,
                "target_unit_cost": 200,
                "maximum_budget": 400000,
                "material": "Bamboo",
                "preferred_sourcing_location": "Bengaluru",
                "delivery_deadline": 35,
                "launch_immediately": False,
            },
        )
        self.assertEqual(code_a, 201)
        mission_a = res_a["mission"]
        self.assertEqual(mission_a["state"], "DRAFT")

        # Edit Mission A draft
        edit_code, edit_res = dispatch_request(
            "PUT",
            f"/api/missions/{mission_a['id']}",
            self.headers,
            {"packaging_requirements": "Zero-plastic kraft sleeve"},
        )
        self.assertEqual(edit_code, 200)
        self.assertEqual(
            edit_res["mission"]["packaging_requirements"], "Zero-plastic kraft sleeve"
        )

        # Launch Mission A -> state changes and suppliers/RFQs are created
        launch_code, launch_res = dispatch_request(
            "POST", f"/api/missions/{mission_a['id']}/launch", self.headers, {}
        )
        self.assertEqual(launch_code, 200)
        self.assertEqual(launch_res["mission"]["state"], "WAITING_FOR_RESPONSE")
        self.assertGreater(len(launch_res["mission"]["suppliers"]), 0)

        # Create Mission B (Custom Office Merchandise) as independent draft
        code_b, res_b = dispatch_request(
            "POST",
            "/api/missions",
            self.headers,
            {
                "mission_name": "Custom Office Merchandise",
                "product_name": "Custom Office Kits",
                "quantity": 500,
                "target_unit_cost": 300,
                "maximum_budget": 150000,
                "material": "Cork & Organic Cotton",
                "preferred_sourcing_location": "Bengaluru",
                "delivery_deadline": 25,
                "launch_immediately": False,
            },
        )
        self.assertEqual(code_b, 201)
        mission_b = res_b["mission"]
        self.assertEqual(mission_b["state"], "DRAFT")
        self.assertEqual(len(mission_b["suppliers"]), 0)

        # Verify both missions exist independently
        _, all_res = dispatch_request("GET", "/api/missions", self.headers)
        self.assertEqual(len(all_res["missions"]), 2)
