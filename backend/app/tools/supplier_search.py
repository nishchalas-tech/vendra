"""
Live Internet Supplier Discovery Tool (backend/app/tools/supplier_search.py)
Delegates to the unified `backend/app/services/supplier_discovery_service.py`
so the Main UI, Mission Workflows, and Vendra AI Chatbot all share the exact same
Live Internet Supplier Discovery pipeline.
"""
from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.database.session import fetch_all, get_db
from app.services.supplier_discovery_service import (
    build_dynamic_search_queries,
    discover_suppliers_live,
    evaluate_and_rank_live_candidates,
)

__all__ = [
    "build_dynamic_search_queries",
    "evaluate_and_rank_suppliers",
    "search_suppliers_for_mission",
]


def evaluate_and_rank_suppliers(
    candidates: List[Dict[str, Any]],
    mission: Dict[str, Any],
    exclude_supplier_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    return evaluate_and_rank_live_candidates(
        candidates=candidates,
        mission=mission,
        exclude_supplier_ids=exclude_supplier_ids,
    )


def search_suppliers_for_mission(
    mission: Dict[str, Any],
    exclude_supplier_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Executes supplier discovery for a mission:
    - If mission["is_demo"] is True (Explicit Demo Mode): uses the deterministic demo catalog
      so the scripted Supplier B 25d -> 42d delay recovery demo scenario works identically.
    - If mission["is_demo"] is False (Normal User Mission):
      Calls `discover_suppliers_live` in `backend/app/services/supplier_discovery_service.py`
      to perform real live internet search based on the mission's actual product and material requirements.
    """
    is_demo = bool(mission.get("is_demo", False))

    if is_demo:
        with get_db() as conn:
            demo_rows = fetch_all(
                conn,
                "SELECT * FROM suppliers WHERE demo_supplier = 1 ORDER BY reliability_score DESC",
            )
        return evaluate_and_rank_live_candidates(
            candidates=demo_rows,
            mission=mission,
            exclude_supplier_ids=exclude_supplier_ids,
        )

    # Normal Mode -> Real Live Internet Search via supplier_discovery_service
    discovery_result = discover_suppliers_live(
        mission=mission,
        exclude_supplier_ids=exclude_supplier_ids,
        max_results=8,
    )
    live_suppliers = discovery_result.get("suppliers") or []
    mission["_last_search_queries"] = discovery_result.get("search_queries") or []
    mission["_last_requirements"] = discovery_result.get("requirements") or []

    if live_suppliers:
        mission["_last_discovery_mode"] = "LIVE_WEB_SEARCH"
        return live_suppliers

    # Deterministic fallback ONLY if outbound internet is completely unreachable
    logger.warning(
        "Outbound live internet supplier search unreachable; using fallback catalog."
    )
    mission["_last_discovery_mode"] = "FALLBACK_CATALOG"
    with get_db() as conn:
        fallback_rows = fetch_all(
            conn,
            "SELECT * FROM suppliers WHERE demo_supplier = 0 ORDER BY reliability_score DESC",
        )
        if not fallback_rows:
            fallback_rows = fetch_all(
                conn,
                "SELECT * FROM suppliers ORDER BY reliability_score DESC",
            )
    for r in fallback_rows:
        r["discovery_source"] = "FALLBACK_CATALOG"
        r["verification_status"] = "DEMO_ILLUSTRATIVE"
    return evaluate_and_rank_live_candidates(
        candidates=fallback_rows,
        mission=mission,
        exclude_supplier_ids=exclude_supplier_ids,
    )
