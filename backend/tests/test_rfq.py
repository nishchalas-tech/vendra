"""
RFQ Generation & Supplier Response Parsing Tests (backend/tests/test_rfq.py)
Covers: RFQ generation, sending, response parsing, and preserving null/unknown for missing fields.
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend
from app.tools.response_parser import parse_supplier_response_payload


class TestRFQAndResponseParsing(unittest.TestCase):
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
                "full_name": "Meera Nair",
                "email": "meera@vendra.in",
                "password": "Password123!",
            },
        )
        self.headers = {"Authorization": f"Bearer {data['token']}"}

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_missing_response_data_remains_null(self) -> None:
        # Missing fields must remain None (null / unknown) — never invented
        parsed = parse_supplier_response_payload(
            {"raw_message": "We can supply at ₹240/unit within 20 days."},
            is_demo=True,
        )
        self.assertEqual(parsed["unit_price"], 240.0)
        self.assertEqual(parsed["lead_time_days"], 20)
        self.assertIsNone(parsed["moq"])
        self.assertIsNone(parsed["certifications"])
        self.assertIsNone(parsed["packaging"])
        self.assertIsNone(parsed["payment_terms"])

    def test_rfq_generation_and_dispatch(self) -> None:
        _, m_res = dispatch_request(
            "POST",
            "/api/missions",
            self.headers,
            {
                "mission_name": "Reusable Bottles Batch",
                "product_name": "Reusable Steel Bottles",
                "quantity": 1000,
                "target_unit_cost": 280,
                "maximum_budget": 300000,
                "material": "SS 304",
                "delivery_deadline": 30,
            },
        )
        mid = m_res["mission"]["id"]
        rfq_code, rfq_res = dispatch_request(
            "POST",
            f"/api/missions/{mid}/rfqs",
            self.headers,
            {"supplier_id": "sup_peenya_01", "auto_send": False},
        )
        self.assertEqual(rfq_code, 201)
        self.assertEqual(rfq_res["rfq"]["status"], "READY")

        send_code, send_res = dispatch_request(
            "POST",
            f"/api/rfqs/{rfq_res['rfq']['id']}/send",
            self.headers,
            {},
        )
        self.assertEqual(send_code, 200)
        self.assertEqual(send_res["rfq"]["status"], "SENT")
