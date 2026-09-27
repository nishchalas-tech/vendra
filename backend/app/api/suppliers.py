"""
Suppliers API Handlers (backend/app/api/suppliers.py)
"""
from typing import Any, Dict, Optional, Tuple
from backend.app.services.supplier_discovery_service import list_sourcing_activities
from backend.app.services.supplier_service import get_supplier, list_all_suppliers


def handle_list_suppliers(include_demo: bool = True) -> Tuple[int, Dict[str, Any]]:
    return 200, {"suppliers": list_all_suppliers(include_demo=include_demo)}


def handle_get_supplier(supplier_id: str) -> Tuple[int, Dict[str, Any]]:
    sup = get_supplier(supplier_id)
    if not sup:
        return 404, {"error": "Supplier not found."}
    return 200, {"supplier": sup}


def handle_list_sourcing_activities(
    user: Dict[str, Any], mission_id: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    activities = list_sourcing_activities(
        user_id=user.get("id") if user else None, mission_id=mission_id
    )
    return 200, {"activities": activities}
