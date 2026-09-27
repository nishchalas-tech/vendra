"""
Supplier Service (backend/app/services/supplier_service.py)
Implements Section 22 & Live Internet Supplier Discovery:
Discovers, normalizes, verifies, and persists live internet suppliers matched to mission
requirements and constraints via `supplier_discovery_service`, while keeping seeded demo
suppliers isolated to Demo Mode.
"""
import json
import urllib.parse
from typing import Any, Dict, List, Optional
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, get_db
from app.services.supplier_discovery_service import _classify_supplier_type
from app.tools.supplier_lookup import lookup_supplier_by_id
from app.tools.supplier_search import search_suppliers_for_mission


def _extract_domain(url: str) -> str:
    if not url:
        return "web"
    try:
        return urllib.parse.urlparse(url).netloc.replace("www.", "").lower() or "web"
    except Exception:
        return "web"


def _hydrate_supplier_dict(r: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(r)
    is_demo = bool(d.get("demo_supplier", 0))
    d["demo_supplier"] = is_demo
    d["supplier_name"] = d.get("supplier_name") or d.get("name") or "Verified Web Supplier"
    d["moq_verified"] = bool(d.get("moq_verified", 1 if is_demo else 0))
    d["price_verified"] = bool(d.get("price_verified", 1 if is_demo else 0))
    d["lead_time_verified"] = bool(d.get("lead_time_verified", 1 if is_demo else 0))

    raw_stype = str(d.get("supplier_type") or "").strip().upper()
    if not raw_stype or raw_stype == "MANUFACTURER":
        inferred_stype = _classify_supplier_type(
            supplier_name=str(d.get("supplier_name") or d.get("name") or ""),
            business_type=str(d.get("manufacturing_capabilities") or ""),
            capability_text=f"{d.get('manufacturing_capabilities') or ''} {d.get('materials') or ''}",
            matched_req_name=str(d.get("matched_requirement") or d.get("materials") or ""),
            matched_req_type="",
            product_name="",
        )
        d["supplier_type"] = inferred_stype if inferred_stype != "RETAILER" else "MANUFACTURER"
    else:
        d["supplier_type"] = raw_stype

    if not d.get("discovery_source"):
        d["discovery_source"] = "DEMO_CATALOG" if is_demo else "LIVE_WEB_SEARCH"
    if not d.get("verification_status"):
        d["verification_status"] = (
            "DEMO_ILLUSTRATIVE"
            if is_demo
            else (
                "VERIFIED_WEB_SOURCE"
                if (d["moq_verified"] or d["price_verified"])
                else "PARTIAL_WEB_DATA_NEEDS_RFQ"
            )
        )

    try:
        mf = json.loads(d.get("match_factors_json") or "{}") if isinstance(d.get("match_factors_json"), str) else (d.get("match_factors") or {})
    except Exception:
        mf = {}

    d["source_domain"] = (
        d.get("source_domain")
        or mf.get("source_domain")
        or _extract_domain(str(d.get("source_url") or d.get("website") or ""))
    )
    d["moq_display"] = (
        d.get("moq_display")
        or mf.get("moq_display")
        or (
            f"{int(d.get('minimum_order_quantity') or 0):,} units"
            if (is_demo or d["moq_verified"])
            else "Not publicly listed"
        )
    )
    d["price_display"] = (
        d.get("price_display")
        or mf.get("price_display")
        or (
            f"₹{float(d.get('indicative_unit_price_inr') or 0):,.0f}/unit"
            if (is_demo or d["price_verified"])
            else "Quote required"
        )
    )
    d["lead_time_display"] = (
        d.get("lead_time_display")
        or mf.get("lead_time_display")
        or (
            f"{int(d.get('lead_time_days') or 0)} days"
            if (is_demo or d["lead_time_verified"])
            else "Not publicly listed"
        )
    )
    return d


def list_all_suppliers(include_demo: bool = True) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if include_demo:
            rows = fetch_all(
                conn,
                """
                SELECT * FROM suppliers
                WHERE discovery_source != 'FALLBACK_CATALOG'
                ORDER BY demo_supplier ASC, updated_at DESC, reliability_score DESC
                """,
            )
        else:
            rows = fetch_all(
                conn,
                """
                SELECT * FROM suppliers
                WHERE demo_supplier = 0 AND discovery_source != 'FALLBACK_CATALOG'
                ORDER BY updated_at DESC, reliability_score DESC
                """,
            )
    return [_hydrate_supplier_dict(r) for r in rows]


def get_supplier(supplier_id: str) -> Optional[Dict[str, Any]]:
    sup = lookup_supplier_by_id(supplier_id)
    return _hydrate_supplier_dict(sup) if sup else None


def upsert_supplier_record(conn: Any, sup: Dict[str, Any], now: str) -> None:
    """
    Persists a discovered live web supplier (or updates an existing supplier record)
    in the relational suppliers table so foreign keys in mission_suppliers, rfqs,
    and supplier_responses remain 100% referentially intact.
    """
    is_demo = 1 if sup.get("demo_supplier") else 0
    sup_name = sup.get("supplier_name") or sup.get("name") or "Verified Web Supplier"
    conn.execute(
        """
        INSERT INTO suppliers (
            supplier_id, name, location, area, city, state,
            manufacturing_capabilities, materials, minimum_order_quantity,
            indicative_unit_price_inr, lead_time_days, certifications,
            packaging_capabilities, payment_terms, shipping_regions,
            reliability_score, evidence, demo_supplier,
            website, source_url, source_title, source_snippet,
            discovery_source, verification_status, search_query_used,
            matched_requirement, contact_info, confidence_score,
            moq_verified, price_verified, lead_time_verified,
            supplier_type,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?,
            ?, ?
        )
        ON CONFLICT(supplier_id) DO UPDATE SET
            name = excluded.name,
            location = excluded.location,
            area = excluded.area,
            city = excluded.city,
            state = excluded.state,
            manufacturing_capabilities = excluded.manufacturing_capabilities,
            materials = excluded.materials,
            minimum_order_quantity = excluded.minimum_order_quantity,
            indicative_unit_price_inr = excluded.indicative_unit_price_inr,
            lead_time_days = excluded.lead_time_days,
            certifications = excluded.certifications,
            packaging_capabilities = excluded.packaging_capabilities,
            payment_terms = excluded.payment_terms,
            shipping_regions = excluded.shipping_regions,
            reliability_score = excluded.reliability_score,
            evidence = excluded.evidence,
            demo_supplier = excluded.demo_supplier,
            website = excluded.website,
            source_url = excluded.source_url,
            source_title = excluded.source_title,
            source_snippet = excluded.source_snippet,
            discovery_source = excluded.discovery_source,
            verification_status = excluded.verification_status,
            search_query_used = excluded.search_query_used,
            matched_requirement = excluded.matched_requirement,
            contact_info = excluded.contact_info,
            confidence_score = excluded.confidence_score,
            moq_verified = excluded.moq_verified,
            price_verified = excluded.price_verified,
            lead_time_verified = excluded.lead_time_verified,
            supplier_type = excluded.supplier_type,
            updated_at = excluded.updated_at
        """,
        (
            sup["supplier_id"],
            sup_name,
            sup.get("location") or "Not publicly listed",
            sup.get("area") or sup.get("city") or "Not publicly listed",
            sup.get("city") or "Not publicly listed",
            sup.get("state") or "India",
            sup.get("manufacturing_capabilities") or "",
            sup.get("materials") or "",
            int(sup.get("minimum_order_quantity") or 500),
            float(sup.get("indicative_unit_price_inr") or 250.0),
            int(sup.get("lead_time_days") or 30),
            sup.get("certifications") or "Not verified",
            sup.get("packaging_capabilities") or "Quote required",
            sup.get("payment_terms") or "Quote required",
            sup.get("shipping_regions") or "India",
            float(sup.get("reliability_score") or 85.0),
            sup.get("evidence") or "Live Web Search",
            is_demo,
            sup.get("website") or "",
            sup.get("source_url") or "",
            sup.get("source_title") or "",
            sup.get("source_snippet") or sup.get("evidence") or "",
            sup.get("discovery_source")
            or ("DEMO_CATALOG" if is_demo else "LIVE_WEB_SEARCH"),
            sup.get("verification_status")
            or ("DEMO_ILLUSTRATIVE" if is_demo else "PARTIAL_WEB_DATA_NEEDS_RFQ"),
            sup.get("search_query_used") or "",
            sup.get("matched_requirement") or "",
            sup.get("contact_info") or "Not publicly listed",
            float(sup.get("confidence_score") or 0.85),
            1 if sup.get("moq_verified") else 0,
            1 if sup.get("price_verified") else 0,
            1 if sup.get("lead_time_verified") else 0,
            sup.get("supplier_type") or "MANUFACTURER",
            now,
            now,
        ),
    )


def discover_and_persist_mission_suppliers(
    mission: Dict[str, Any],
    is_recovery: bool = False,
    exclude_supplier_ids: Optional[List[str]] = None,
    top_n: int = 6,
) -> List[Dict[str, Any]]:
    ranked = search_suppliers_for_mission(
        mission=mission, exclude_supplier_ids=exclude_supplier_ids
    )
    selected_batch = ranked[:top_n]
    now = utc_now_iso()

    last_queries = mission.get("_last_search_queries") or mission.get("search_queries") or []
    last_reqs = mission.get("_last_requirements") or mission.get("requirements") or []
    discovery_mode = (
        mission.get("_last_discovery_mode")
        or ("DEMO_CATALOG" if mission.get("is_demo") else "LIVE_WEB_SEARCH")
    )

    with get_db() as conn:
        if last_reqs or last_queries:
            conn.execute(
                """
                UPDATE missions SET
                    requirements_json = COALESCE(?, requirements_json),
                    search_queries_json = COALESCE(?, search_queries_json),
                    discovery_mode = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    json.dumps(last_reqs) if last_reqs else None,
                    json.dumps(last_queries) if last_queries else None,
                    discovery_mode,
                    now,
                    mission["id"],
                ),
            )

        # If this is a non-demo mission and we found real live web suppliers, replace old non-selected supplier links
        if (
            not mission.get("is_demo")
            and discovery_mode == "LIVE_WEB_SEARCH"
            and not is_recovery
            and len(selected_batch) > 0
        ):
            conn.execute(
                """
                DELETE FROM mission_suppliers
                WHERE mission_id = ? AND is_selected = 0
                """,
                (mission["id"],),
            )

        for sup in selected_batch:
            upsert_supplier_record(conn, sup, now)
            ms_id = new_id("msup")
            conn.execute(
                """
                INSERT INTO mission_suppliers (
                    id, mission_id, supplier_id, match_factors_json,
                    eligibility_status, risk_level, is_selected,
                    is_recovery_alternative, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(mission_id, supplier_id) DO UPDATE SET
                    match_factors_json = excluded.match_factors_json,
                    eligibility_status = excluded.eligibility_status,
                    risk_level = excluded.risk_level,
                    is_recovery_alternative = CASE
                        WHEN excluded.is_recovery_alternative = 1 THEN 1
                        ELSE mission_suppliers.is_recovery_alternative
                    END,
                    updated_at = excluded.updated_at
                """,
                (
                    ms_id,
                    mission["id"],
                    sup["supplier_id"],
                    json.dumps(sup["match_factors"]),
                    sup["eligibility_status"],
                    sup["risk_level"],
                    1
                    if sup["supplier_id"] == mission.get("selected_supplier_id")
                    else 0,
                    1 if is_recovery else 0,
                    now,
                    now,
                ),
            )

    return get_mission_suppliers(mission["id"])


def get_mission_suppliers(mission_id: str) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT s.*, ms.match_factors_json, ms.eligibility_status,
                   ms.risk_level, ms.is_selected, ms.is_recovery_alternative
            FROM mission_suppliers ms
            JOIN suppliers s ON s.supplier_id = ms.supplier_id
            WHERE ms.mission_id = ?
            ORDER BY ms.is_selected DESC, s.demo_supplier ASC, s.reliability_score DESC
            """,
            (mission_id,),
        )
    results: List[Dict[str, Any]] = []
    for r in rows:
        d = _hydrate_supplier_dict(r)
        d["is_selected"] = bool(d.get("is_selected", 0))
        d["is_recovery_alternative"] = bool(d.get("is_recovery_alternative", 0))
        try:
            d["match_factors"] = json.loads(d.get("match_factors_json") or "{}")
        except Exception:
            d["match_factors"] = {}
        results.append(d)
    return results
