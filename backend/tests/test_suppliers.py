"""
Supplier Engine & Filtering Tests (backend/tests/test_suppliers.py)
"""
import os
import tempfile
import unittest
from backend.app.main import dispatch_request, initialize_backend
from backend.app.tools.supplier_search import search_suppliers_for_mission


class TestSuppliers(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        os.environ["VENDRA_SQLITE_PATH"] = self.tmp.name
        initialize_backend()

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_supplier_filtering_and_transparent_match_factors(self) -> None:
        mission = {
            "product_name": "Bamboo Lunch Boxes",
            "product_category": "Sustainable Foodware",
            "product_description": "Compression molded bamboo lunch containers",
            "material": "Bamboo",
            "quantity": 2000,
            "target_unit_cost": 200.0,
            "maximum_budget": 400000.0,
            "delivery_deadline": 35,
            "certification_requirements": "ISO 9001",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "packaging_requirements": "Kraft",
        }
        results = search_suppliers_for_mission(mission)
        self.assertGreaterEqual(len(results), 10)
        top = results[0]
        self.assertEqual(top["eligibility_status"], "Eligible")
        self.assertIn("match_factors", top)
        self.assertTrue(top["match_factors"]["moq_compatible"])
        self.assertTrue(top["match_factors"]["within_budget"])
        self.assertTrue(top["demo_supplier"])
