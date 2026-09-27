"""
Supplier Lookup Tool (backend/app/tools/supplier_lookup.py)
"""
from typing import Any, Dict, Optional
from app.database.session import fetch_one, get_db


def lookup_supplier_by_id(supplier_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = fetch_one(
            conn, "SELECT * FROM suppliers WHERE supplier_id = ?", (supplier_id,)
        )
    if not row:
        return None
    row["demo_supplier"] = bool(row.get("demo_supplier", 1))
    return row
