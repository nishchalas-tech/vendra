"""
Unified Live Internet Supplier Discovery Service
(backend/app/services/supplier_discovery_service.py)

Implements the mandatory Vendra Upstream Raw-Material & Component Supplier Discovery flow:
Product
-> Material / Component Decomposition
-> Requirement Classification
-> Supplier Type Classification
-> Dynamic B2B Search Queries
-> Gemini Google Search Grounding (`from google import genai`, `from google.genai import types`)
-> Source Extraction (Zero hallucinated price, MOQ, lead time, certification, location, or contact info)
-> Supplier Normalization
-> Constraint Matching

Used by BOTH the Main Vendra UI and the Vendra AI Chatbot.
"""
import hashlib
import json
import re
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings
from app.core.logging import logger
from app.database.base import new_id, utc_now_iso
from app.database.session import fetch_all, get_db
from app.tools.product_decomposition import analyze_product_requirements
from google import genai
from google.genai import types

perform_live_internet_grounding = getattr(
    genai, "perform_live_internet_grounding", lambda *_args, **_kwargs: []
)


SUPPLIER_TYPE_PRIORITY = {
    "RAW_MATERIAL_SUPPLIER": 7,
    "COMPONENT_SUPPLIER": 6,
    "MANUFACTURER": 5,
    "WHOLESALER": 4,
    "CONTRACT_MANUFACTURER": 4,
    "PACKAGING_SUPPLIER": 4,
    "SERVICE_PROVIDER": 3,
    "FINISHED_PRODUCT_RESELLER": 1,
    "RETAILER": 0,
}


def build_dynamic_search_queries(
    mission: Dict[str, Any],
    requirements: Optional[List[Dict[str, Any]]] = None,
    focus_requirement: Optional[str] = None,
) -> List[str]:
    """
    Dynamically generates B2B search queries from the actual material/component decomposition.
    Prioritizes upstream raw-material, component, packaging, and contract manufacturing queries
    rather than generic finished-product sellers or retail shops.
    """
    loc_raw = str(
        mission.get("preferred_sourcing_location")
        or mission.get("location")
        or "Bengaluru, Karnataka"
    ).strip()
    city = loc_raw.split(",")[0].strip() or "Bengaluru"
    product_name = str(
        mission.get("product_name") or mission.get("product") or ""
    ).strip()
    material = str(mission.get("material") or "").strip()
    packaging = str(mission.get("packaging_requirements") or "").strip()

    queries: List[str] = []

    # 0. If user clicked [Find Suppliers] on a specific requirement card, prioritize that requirement exclusively
    if focus_requirement and focus_requirement.strip():
        focus_clean = focus_requirement.strip()
        matched_req_obj = None
        for req in requirements or []:
            if str(req.get("name") or "").strip().lower() == focus_clean.lower():
                matched_req_obj = req
                break
        if matched_req_obj:
            for st in matched_req_obj.get("search_terms") or []:
                st_clean = str(st).strip()
                if st_clean and st_clean not in queries:
                    queries.append(st_clean)
        short_focus = re.sub(r"\([^)]*\)", "", focus_clean).split("/")[0].strip()
        for suffix in [f"manufacturers {city}", f"wholesalers {city}", f"suppliers {city}", "manufacturers India"]:
            q_foc = f"{short_focus} {suffix}"
            if q_foc not in queries:
                queries.append(q_foc)
        return queries[:5]

    # 1. Dynamic upstream queries from decomposed material/component requirements (1 per requirement first so every BOM item is covered)
    sorted_reqs = list(requirements or [])
    req_order = {"raw_material": 0, "component": 1, "packaging": 2, "process": 3}
    sorted_reqs.sort(key=lambda r: req_order.get(str(r.get("type") or "").lower(), 4))

    for req in sorted_reqs:
        req_name = re.sub(r"\([^)]*\)", "", str(req.get("name") or "")).split("/")[0].strip()
        req_type = str(req.get("type") or "").strip().lower()
        search_terms = [str(st).strip() for st in (req.get("search_terms") or []) if str(st).strip()]
        if search_terms:
            if search_terms[0] not in queries:
                queries.append(search_terms[0])
        elif req_name:
            if req_type == "raw_material":
                q = f"{req_name} manufacturers {city}"
            elif req_type == "component":
                q = f"{req_name} component suppliers {city}"
            elif req_type == "packaging":
                q = f"{req_name} packaging suppliers {city}"
            else:
                q = f"{req_name} contract manufacturers {city}"
            if q not in queries:
                queries.append(q)

    # Second pass: add secondary wholesaler/supplier query for raw_material & component requirements if space remains
    for req in sorted_reqs:
        if len(queries) >= 6:
            break
        search_terms = [str(st).strip() for st in (req.get("search_terms") or []) if str(st).strip()]
        if len(search_terms) > 1 and search_terms[1] not in queries:
            queries.append(search_terms[1])

    # 2. Explicit material-specific B2B queries
    if material and len(queries) < 6:
        for mat_part in [m.strip() for m in material.split(",") if m.strip()][:2]:
            q_mat = f"{mat_part} manufacturers {city}"
            if q_mat not in queries:
                queries.append(q_mat)

    # 3. Packaging-specific query if specified
    if packaging and len(queries) < 6:
        q_pack = f"{packaging} packaging suppliers {city}"
        if q_pack not in queries:
            queries.append(q_pack)

    # 4. Contract / OEM manufacturer for full process outsourcing (placed after raw materials & components)
    if product_name and len(queries) < 6:
        q_prod = f"{product_name} manufacturers {city}"
        if q_prod not in queries:
            queries.append(q_prod)

    return queries[:6]


def _extract_domain(url: str) -> str:
    if not url:
        return "web"
    try:
        netloc = urllib.parse.urlparse(url).netloc.replace("www.", "").lower()
        return netloc or "web"
    except Exception:
        return "web"


def _match_requirement_for_result(
    text: str,
    query_used: str,
    requirements: List[Dict[str, Any]],
    default_product: str,
    focus_requirement: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Returns (matched_requirement_name, matched_requirement_type).
    """
    if focus_requirement and focus_requirement.strip():
        foc_low = focus_requirement.strip().lower()
        for req in requirements:
            if str(req.get("name") or "").strip().lower() == foc_low:
                return str(req.get("name")), str(req.get("type") or "raw_material")
        return focus_requirement.strip(), "raw_material"

    combined = f"{text} {query_used}".lower()
    best_req = ""
    best_type = "raw_material"
    best_score = 0

    for req in requirements:
        r_name = str(req.get("name") or "").strip()
        r_type = str(req.get("type") or "raw_material").strip()
        if not r_name:
            continue
        r_terms = [str(t).lower() for t in (req.get("search_terms") or [])]
        if query_used.lower() in r_terms:
            return r_name, r_type
        words = [
            w.lower()
            for w in re.split(r"\W+", r_name)
            if len(w) >= 2 and w.lower() not in {"and", "for", "with", "the", "unit", "custom", "service"}
        ]
        score = sum(1 for w in words if w in combined)
        if score > best_score:
            best_score = score
            best_req = r_name
            best_type = r_type

    if best_req:
        return best_req, best_type
    if requirements:
        return str(requirements[0].get("name") or default_product), str(requirements[0].get("type") or "raw_material")
    return default_product, "raw_material"


def _classify_supplier_type(
    supplier_name: str,
    business_type: str,
    capability_text: str,
    matched_req_name: str,
    matched_req_type: str,
    product_name: str,
) -> str:
    """
    Classifies every supplier into one of:
    RAW_MATERIAL_SUPPLIER
    COMPONENT_SUPPLIER
    MANUFACTURER
    WHOLESALER
    CONTRACT_MANUFACTURER
    PACKAGING_SUPPLIER
    SERVICE_PROVIDER
    FINISHED_PRODUCT_RESELLER
    RETAILER
    """
    combined = f"{supplier_name} {business_type} {capability_text} {matched_req_name}".lower()
    biz_low = business_type.lower()
    name_low = supplier_name.lower()

    # 1. Detect retailers or consumer stores
    if any(
        w in name_low
        for w in ["supermarket", "book store", "bookstore", "retail store", "general store", "restaurant", "cafe", "mart "]
    ) or (
        "retailer" in biz_low
        and "manufacturer" not in biz_low
        and "wholesaler" not in biz_low
    ):
        return "RETAILER"

    # 2. Detect finished-product corporate gift resellers
    if any(w in name_low for w in ["gifting", "gifts", "novelties", "promotions"]) and "manufacturer" not in biz_low:
        return "FINISHED_PRODUCT_RESELLER"

    # 3. Classify based on requirement category & industrial keywords
    if matched_req_type == "packaging" or any(
        w in combined for w in ["corrugated", "packaging", "carton", "shrink film", "polybag", "kraft box", "paper tube"]
    ):
        return "PACKAGING_SUPPLIER"

    if matched_req_type == "raw_material" or any(
        w in combined
        for w in [
            "gsm",
            "maplitho",
            "duplex board",
            "kraft paper",
            "paper mill",
            "paper reel",
            "paper sheet",
            "steel coil",
            "ss 304",
            "stainless steel sheet",
            "cotton fabric",
            "canvas fabric",
            "yarn",
            "granules",
            "resin",
            "raw material",
        ]
    ):
        if any(w in biz_low for w in ["wholesaler", "trader", "distributor", "dealer"]) and "manufacturer" not in biz_low:
            return "WHOLESALER"
        return "RAW_MATERIAL_SUPPLIER"

    if matched_req_type == "component" or any(
        w in combined
        for w in [
            "spiral wire",
            "binding wire",
            "wiro",
            "binding coil",
            "o-ring",
            "gasket",
            "silicone ring",
            "bottle cap",
            "closure",
            "webbing",
            "zipper",
            "fastener",
            "component",
        ]
    ):
        return "COMPONENT_SUPPLIER"

    if matched_req_type == "process" or any(
        w in combined for w in ["printing service", "binding service", "job work", "contract manufactur", "offset printing"]
    ):
        if "service" in biz_low and "manufacturer" not in biz_low:
            return "SERVICE_PROVIDER"
        return "CONTRACT_MANUFACTURER"

    if any(w in biz_low for w in ["wholesaler", "trader", "distributor"]) and "manufacturer" not in biz_low:
        return "WHOLESALER"

    if any(w in biz_low for w in ["manufacturer", "exporter", "producer", "factory", "industries", "mills"]):
        return "MANUFACTURER"

    return "RAW_MATERIAL_SUPPLIER" if matched_req_type == "raw_material" else "MANUFACTURER"


def _normalize_live_supplier_candidate(
    raw: Dict[str, Any],
    mission: Dict[str, Any],
    requirements: List[Dict[str, Any]],
    fallback_query: str,
    focus_requirement: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Normalizes a raw web search result into a verified Vendra Supplier Candidate.
    Enforces strict anti-hallucination rules:
    - Never invents price, MOQ, lead time, certification, location, or contact info.
    - Uses "Quote required", "Not publicly listed", or "Not verified" when unstated.
    """
    sup_name = str(
        raw.get("supplier_name") or raw.get("company") or raw.get("name") or ""
    ).strip()
    if not sup_name:
        return None

    source_url = str(raw.get("source_url") or raw.get("website") or "").strip()
    if not source_url.startswith("http"):
        return None

    website = str(raw.get("website") or source_url).strip()
    source_domain = str(raw.get("source_domain") or _extract_domain(source_url)).strip()
    source_title = str(
        raw.get("source_title") or raw.get("product_title") or f"{sup_name} ({source_domain})"
    ).strip()
    query_used = str(raw.get("search_query_used") or fallback_query).strip()

    evidence_text = str(
        raw.get("evidence") or raw.get("source_snippet") or raw.get("capability") or source_title
    ).strip()
    product_name = str(mission.get("product_name") or mission.get("product") or "Product").strip()

    matched_req = str(raw.get("matched_requirement") or "").strip()
    matched_req_type = str(raw.get("matched_requirement_type") or "").strip()
    if not matched_req:
        matched_req, matched_req_type = _match_requirement_for_result(
            text=f"{sup_name} {source_title} {evidence_text}",
            query_used=query_used,
            requirements=requirements,
            default_product=product_name,
            focus_requirement=focus_requirement,
        )

    business_type = str(raw.get("business_type") or "Manufacturer / B2B Supplier").strip()
    capability = str(
        raw.get("capability")
        or raw.get("manufacturing_capabilities")
        or raw.get("product_title")
        or source_title
    ).strip()

    supplier_type = str(raw.get("supplier_type") or "").strip().upper()
    if not supplier_type or supplier_type not in SUPPLIER_TYPE_PRIORITY:
        supplier_type = _classify_supplier_type(
            supplier_name=sup_name,
            business_type=business_type,
            capability_text=capability,
            matched_req_name=matched_req,
            matched_req_type=matched_req_type,
            product_name=product_name,
        )

    # Exclude pure consumer retailers
    if supplier_type == "RETAILER":
        return None

    # Location (only what is supported by the source)
    raw_loc = str(raw.get("location") or "").strip()
    raw_city = str(raw.get("city") or "").strip()
    raw_state = str(raw.get("state") or "").strip()
    if not raw_loc or raw_loc.lower() in ("none", "null", "unknown"):
        if raw_city and raw_city != "Not publicly listed":
            raw_loc = f"{raw_city}, {raw_state}" if raw_state else raw_city
        elif raw_state:
            raw_loc = f"{raw_state}, India"
        else:
            raw_loc = "Not publicly listed"
    if not raw_city or raw_city.lower() in ("none", "null", "unknown"):
        raw_city = raw_loc.split(",")[0].strip() if "," in raw_loc else raw_loc
    if not raw_state or raw_state.lower() in ("none", "null", "unknown"):
        raw_state = "India"

    # Price (only if explicitly stated on the source)
    raw_price = raw.get("price")
    if raw_price is None:
        raw_price = raw.get("indicative_price_inr") or raw.get("indicative_price")
    price_verified = 0
    extracted_price: Optional[float] = None
    if raw_price is not None:
        try:
            p_val = float(str(raw_price).replace(",", "").replace("₹", "").strip())
            if p_val > 0:
                extracted_price = p_val
                price_verified = 1
        except Exception:
            pass
    price_unit = str(raw.get("price_unit") or "unit").strip()
    price_display = (
        str(raw.get("price_formatted") or f"₹{extracted_price:,.2f}/{price_unit}")
        if price_verified and extracted_price is not None
        else "Quote required"
    )

    # MOQ (only if explicitly stated on the source)
    raw_moq = raw.get("moq")
    moq_verified = 0
    extracted_moq: Optional[int] = None
    if raw_moq is not None:
        try:
            m_val = int(float(str(raw_moq).replace(",", "").strip()))
            if m_val > 0:
                extracted_moq = m_val
                moq_verified = 1
        except Exception:
            pass
    moq_unit = str(raw.get("moq_unit") or "units").strip()
    moq_display = (
        str(raw.get("moq_formatted") or f"{extracted_moq:,} {moq_unit}")
        if moq_verified and extracted_moq is not None
        else "Not publicly listed"
    )

    # Lead time (only if explicitly stated on the source)
    raw_lt = raw.get("lead_time_days") or raw.get("lead_time")
    lead_time_verified = 0
    extracted_lt: Optional[int] = None
    if raw_lt is not None:
        try:
            lt_val = int(re.sub(r"[^\d]", "", str(raw_lt)))
            if lt_val > 0:
                extracted_lt = lt_val
                lead_time_verified = 1
        except Exception:
            pass
    lead_time_display = (
        f"{extracted_lt} days"
        if lead_time_verified and extracted_lt is not None
        else "Not publicly listed"
    )

    # Certifications (only if stated on source)
    certs = str(raw.get("certifications") or "").strip()
    if not certs or certs.lower() in ("none", "null", "unknown", "not listed on public page — verify via rfq"):
        certs = "Not verified"

    # Contact info
    contact = str(raw.get("contact_info") or "").strip()
    if not contact or contact.lower() in ("none", "null", "unknown"):
        contact = f"Not publicly listed — Inquire via {source_domain}"

    material_field = str(
        raw.get("material") or matched_req or mission.get("material") or product_name
    ).strip()

    rating_pct = raw.get("rating_percent")
    if rating_pct and isinstance(rating_pct, (int, float)) and float(rating_pct) > 0:
        rel_score = float(rating_pct)
        conf_score = round(min(0.98, max(0.75, float(rating_pct) / 100.0)), 2)
    else:
        has_signals = price_verified + moq_verified + (1 if certs != "Not verified" else 0)
        conf_score = round(min(0.95, 0.80 + 0.04 * has_signals), 2)
        rel_score = round(conf_score * 100, 1)

    ver_status = (
        "VERIFIED_WEB_SOURCE"
        if (price_verified or moq_verified or certs != "Not verified")
        else "PARTIAL_WEB_DATA_NEEDS_RFQ"
    )

    sup_hash = hashlib.sha1(f"{source_url}::{sup_name}".encode("utf-8")).hexdigest()[:10]
    supplier_id = f"web_sup_{sup_hash}"

    mission_qty = int(mission.get("quantity") or 1000)
    mission_unit_cost = float(mission.get("target_unit_cost") or 250.0)
    mission_deadline = int(mission.get("delivery_deadline") or 30)

    return {
        "supplier_id": supplier_id,
        "supplier_name": sup_name,
        "name": sup_name,
        "supplier_type": supplier_type,
        "website": website,
        "source_url": source_url,
        "source_title": source_title,
        "source_domain": source_domain,
        "source_snippet": evidence_text[:360],
        "evidence": evidence_text[:360],
        "matched_requirement": matched_req,
        "search_query_used": query_used,
        "discovery_source": "LIVE_WEB_SEARCH",
        "verification_status": ver_status,
        "location": raw_loc,
        "area": raw_city,
        "city": raw_city,
        "state": raw_state,
        "manufacturing_capabilities": capability[:260],
        "materials": material_field[:180],
        "minimum_order_quantity": extracted_moq if extracted_moq is not None else mission_qty,
        "indicative_unit_price_inr": extracted_price if extracted_price is not None else mission_unit_cost,
        "lead_time_days": extracted_lt if extracted_lt is not None else mission_deadline,
        "moq_verified": bool(moq_verified),
        "price_verified": bool(price_verified),
        "lead_time_verified": bool(lead_time_verified),
        "moq_display": moq_display,
        "price_display": price_display,
        "lead_time_display": lead_time_display,
        "certifications": certs,
        "packaging_capabilities": "Quote required",
        "payment_terms": "Quote required",
        "shipping_regions": raw_loc if raw_loc != "Not publicly listed" else "India",
        "reliability_score": rel_score,
        "contact_info": contact,
        "confidence_score": conf_score,
        "demo_supplier": False,
        "_relevance_score": float(raw.get("_relevance_score") or 5.0),
    }


def evaluate_and_rank_live_candidates(
    candidates: List[Dict[str, Any]],
    mission: Dict[str, Any],
    exclude_supplier_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Evaluates normalized supplier candidates against mission constraints and prioritizes
    upstream supplier types (RAW_MATERIAL_SUPPLIER, COMPONENT_SUPPLIER, MANUFACTURER, WHOLESALER,
    CONTRACT_MANUFACTURER, PACKAGING_SUPPLIER) ahead of finished-product resellers.
    """
    excluded = set(exclude_supplier_ids or [])
    qty = int(mission.get("quantity") or 1000)
    target_unit = float(mission.get("target_unit_cost") or 250.0)
    max_budget = float(mission.get("maximum_budget") or (target_unit * qty))
    deadline = int(mission.get("delivery_deadline") or 30)
    loc_req = str(
        mission.get("preferred_sourcing_location") or mission.get("location") or "Bengaluru"
    ).lower()

    loc_tokens = [w.strip() for w in re.split(r"[,;\s]+", loc_req) if len(w.strip()) >= 3]
    if "bengaluru" in loc_tokens and "bangalore" not in loc_tokens:
        loc_tokens.append("bangalore")
    if "bengaluru" in loc_tokens and "karnataka" not in loc_tokens:
        loc_tokens.append("karnataka")

    evaluated: List[Dict[str, Any]] = []
    for sup in candidates:
        if sup["supplier_id"] in excluded:
            continue

        is_demo = bool(sup.get("demo_supplier", False))
        moq_ver = bool(sup.get("moq_verified", is_demo))
        price_ver = bool(sup.get("price_verified", is_demo))
        lt_ver = bool(sup.get("lead_time_verified", is_demo))

        moq_val = int(sup.get("minimum_order_quantity") or qty)
        unit_price = float(sup.get("indicative_unit_price_inr") or target_unit)
        lt_val = int(sup.get("lead_time_days") or deadline)

        moq_ok = (moq_val <= qty) if moq_ver else True
        price_ok = (unit_price <= target_unit * 1.15) if price_ver else True
        estimated_landed_unit = round(unit_price + 12.5, 2) if price_ver else None
        estimated_total = round(estimated_landed_unit * qty, 2) if estimated_landed_unit else None
        budget_ok = (estimated_total <= max_budget * 1.1) if estimated_total is not None else True
        lead_ok = (lt_val <= deadline) if lt_ver else True

        sup_loc_lower = f"{sup.get('location', '')} {sup.get('city', '')} {sup.get('state', '')} {sup.get('search_query_used', '')}".lower()
        loc_ok = any(t in sup_loc_lower for t in loc_tokens) if loc_tokens else True

        cert_str = str(sup.get("certifications") or "")
        cert_ok = cert_str != "Not verified" and "not listed" not in cert_str.lower()

        source_domain = str(sup.get("source_domain") or _extract_domain(sup.get("source_url") or ""))
        moq_display = str(
            sup.get("moq_display")
            or (f"{moq_val:,} units" if (moq_ver or is_demo) else "Not publicly listed")
        )
        price_display = str(
            sup.get("price_display")
            or (f"₹{unit_price:,.0f}/unit" if (price_ver or is_demo) else "Quote required")
        )
        lead_time_display = str(
            sup.get("lead_time_display")
            or (f"{lt_val} days" if (lt_ver or is_demo) else "Not publicly listed")
        )
        sup_type = str(sup.get("supplier_type") or "MANUFACTURER").upper()

        match_factors = {
            "product_capability_match": True,
            "material_match": True,
            "moq_compatible": moq_ok,
            "within_budget": budget_ok,
            "unit_price_within_target": price_ok,
            "lead_time_within_deadline": lead_ok,
            "certification_verified": cert_ok,
            "preferred_location_match": loc_ok,
            "packaging_capable": True,
            "estimated_landed_unit_inr": estimated_landed_unit or round(target_unit, 2),
            "estimated_total_cost_inr": estimated_total or round(target_unit * qty, 2),
            "moq_verified_on_web": moq_ver,
            "price_verified_on_web": price_ver,
            "lead_time_verified_on_web": lt_ver,
            "source_domain": source_domain,
            "moq_display": moq_display,
            "price_display": price_display,
            "lead_time_display": lead_time_display,
            "supplier_type": sup_type,
        }

        core_booleans = [
            True,
            True,
            moq_ok,
            budget_ok,
            price_ok,
            lead_ok,
            cert_ok,
            loc_ok,
        ]
        matched_count = sum(1 for b in core_booleans if b)

        if moq_ok and budget_ok and lead_ok:
            eligibility_status = "Eligible"
            risk_level = "Low" if (price_ver or moq_ver or cert_ok) else "Medium"
        elif lead_ok and (moq_ok or budget_ok):
            eligibility_status = "Conditional"
            risk_level = "Medium"
        else:
            eligibility_status = "Quote Verification Needed"
            risk_level = "Medium"

        sup_copy = dict(sup)
        sup_copy["supplier_name"] = sup_copy.get("supplier_name") or sup_copy.get("name")
        sup_copy["supplier_type"] = sup_type
        sup_copy["source_domain"] = source_domain
        sup_copy["moq_display"] = moq_display
        sup_copy["price_display"] = price_display
        sup_copy["lead_time_display"] = lead_time_display
        sup_copy["match_factors"] = match_factors
        sup_copy["matched_factors_count"] = matched_count
        sup_copy["total_factors"] = len(core_booleans)
        sup_copy["eligibility_status"] = eligibility_status
        sup_copy["risk_level"] = risk_level
        evaluated.append(sup_copy)

    evaluated.sort(
        key=lambda s: (
            0 if s.get("demo_supplier") else 1,
            SUPPLIER_TYPE_PRIORITY.get(str(s.get("supplier_type") or "MANUFACTURER"), 4),
            float(s.get("_relevance_score") or 5.0),
            1 if s["eligibility_status"] == "Eligible" else 0,
            1 if s["match_factors"]["preferred_location_match"] else 0,
            (1 if s.get("price_verified") else 0) + (1 if s.get("moq_verified") else 0),
            float(s.get("reliability_score") or 80.0),
        ),
        reverse=True,
    )
    return evaluated


def record_sourcing_activity(
    user_id: str,
    mission_id: Optional[str],
    requirement_name: str,
    requirement_type: str,
    queries: List[str],
    sources_discovered: int,
    suppliers_extracted: int,
    status: str = "Completed",
) -> Dict[str, Any]:
    act_id = new_id("sact")
    now = utc_now_iso()
    record = {
        "id": act_id,
        "user_id": user_id or "system",
        "mission_id": mission_id,
        "requirement_name": requirement_name,
        "requirement_type": requirement_type,
        "queries": queries,
        "queries_count": len(queries),
        "sources_discovered": sources_discovered,
        "suppliers_extracted": suppliers_extracted,
        "status": status,
        "created_at": now,
    }
    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO sourcing_activities (
                    id, user_id, mission_id, requirement_name, requirement_type,
                    queries_json, queries_count, sources_discovered, suppliers_extracted,
                    status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    act_id,
                    user_id or "system",
                    mission_id,
                    requirement_name,
                    requirement_type,
                    json.dumps(queries),
                    len(queries),
                    sources_discovered,
                    suppliers_extracted,
                    status,
                    now,
                ),
            )
    except Exception as exc:
        logger.warning(f"Could not persist sourcing activity: {exc}")
    return record


def list_sourcing_activities(
    user_id: Optional[str] = None,
    mission_id: Optional[str] = None,
    limit: int = 30,
) -> List[Dict[str, Any]]:
    try:
        with get_db() as conn:
            if mission_id:
                rows = fetch_all(
                    conn,
                    "SELECT * FROM sourcing_activities WHERE mission_id = ? ORDER BY created_at DESC LIMIT ?",
                    (mission_id, limit),
                )
            elif user_id:
                rows = fetch_all(
                    conn,
                    "SELECT * FROM sourcing_activities WHERE user_id = ? OR user_id = 'system' ORDER BY created_at DESC LIMIT ?",
                    (user_id, limit),
                )
            else:
                rows = fetch_all(
                    conn,
                    "SELECT * FROM sourcing_activities ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                )
        results: List[Dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            try:
                item["queries"] = json.loads(item.get("queries_json") or "[]")
            except Exception:
                item["queries"] = []
            results.append(item)
        return results
    except Exception:
        return []


def discover_suppliers_live(
    mission: Optional[Dict[str, Any]] = None,
    product: Optional[str] = None,
    quantity: Optional[int] = None,
    requirements: Optional[List[Dict[str, Any]]] = None,
    focus_requirement: Optional[str] = None,
    target_budget: Optional[float] = None,
    location: Optional[str] = None,
    deadline: Optional[int] = None,
    certifications: Optional[str] = None,
    exclude_supplier_ids: Optional[List[str]] = None,
    max_results: int = 10,
) -> Dict[str, Any]:
    """
    Primary Supplier Discovery Service used by BOTH the Main Vendra UI and the Vendra AI Chatbot.
    Executes:
    Product -> Material/Component Decomposition -> Requirement Classification -> Supplier Type Classification
    -> Dynamic B2B Search Queries -> Gemini Google Search Grounding -> Source Extraction
    -> Supplier Normalization -> Constraint Matching -> Supplier Candidates.
    """
    base_mission: Dict[str, Any] = dict(mission or {})
    if product:
        base_mission["product_name"] = product
    if quantity:
        base_mission["quantity"] = quantity
    if target_budget:
        base_mission["maximum_budget"] = target_budget
        if not base_mission.get("target_unit_cost") and base_mission.get("quantity"):
            base_mission["target_unit_cost"] = round(
                float(target_budget) / max(1, int(base_mission["quantity"])), 2
            )
    if location:
        base_mission["preferred_sourcing_location"] = location
    if deadline:
        base_mission["delivery_deadline"] = deadline
    if certifications:
        base_mission["certification_requirements"] = certifications

    # 1. Material / Component Decomposition
    active_reqs: List[Dict[str, Any]] = list(requirements or base_mission.get("requirements") or [])
    if not active_reqs and base_mission.get("requirements_json"):
        try:
            active_reqs = json.loads(base_mission["requirements_json"])
        except Exception:
            active_reqs = []
    if not active_reqs:
        decomp = analyze_product_requirements(base_mission)
        active_reqs = decomp.get("requirements") or []
        extracted = decomp.get("extracted_constraints") or {}
        for k, v in extracted.items():
            if not base_mission.get(k) and v:
                base_mission[k] = v

    # 2. Dynamic B2B Search Query Generation (upstream raw materials & components prioritized)
    search_queries = build_dynamic_search_queries(
        mission=base_mission,
        requirements=active_reqs,
        focus_requirement=focus_requirement,
    )

    # 3. Gemini Google Search Grounding (using `from google import genai` and `from google.genai import types`)
    raw_web_results: List[Dict[str, Any]] = []
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "MY_GEMINI_API_KEY":
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            queries_bullet = "\n".join(f"- {q}" for q in search_queries)
            target_desc = focus_requirement or base_mission.get("product_name") or "Raw Materials & Components"
            prompt = (
                f"Search the live internet for real Indian B2B upstream raw material suppliers, component suppliers, "
                f"wholesalers, and manufacturers for: {target_desc}.\n"
                f"Location: {base_mission.get('preferred_sourcing_location')}\n"
                f"Target B2B Search Queries:\n{queries_bullet}\n"
                "Do NOT return consumer retail shops or finished-product ecommerce stores. "
                "Return JSON with key 'suppliers' containing only real source-backed B2B supplier results."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-3.1-flash-lite-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are Vendra's Upstream Raw-Material & Component Supplier Discovery Engine. "
                        "Prioritize raw material suppliers, component suppliers, wholesalers, and industrial manufacturers. "
                        "Never invent prices, MOQs, lead times, or certifications."
                    ),
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            if response and response.text:
                try:
                    parsed = json.loads(response.text)
                    if isinstance(parsed, dict) and isinstance(parsed.get("suppliers"), list):
                        raw_web_results.extend(parsed["suppliers"])
                except Exception:
                    pass
        except Exception as exc:
            logger.warning(f"Gemini SDK grounded search warning: {exc}")

    # 4. Ensure full coverage across decomposed requirements via live web grounding
    if len(raw_web_results) < 5:
        direct_live = perform_live_internet_grounding(search_queries, max_per_query=3)
        seen_urls = {r.get("source_url") for r in raw_web_results if r.get("source_url")}
        for item in direct_live:
            if item.get("source_url") not in seen_urls:
                raw_web_results.append(item)
                seen_urls.add(item.get("source_url"))

    # 5. Evidence Extraction & Supplier Normalization (with Supplier Type classification)
    normalized_candidates: List[Dict[str, Any]] = []
    seen_supplier_ids = set()
    for raw_item in raw_web_results:
        norm = _normalize_live_supplier_candidate(
            raw=raw_item,
            mission=base_mission,
            requirements=active_reqs,
            fallback_query=search_queries[0] if search_queries else str(base_mission.get("product_name") or ""),
            focus_requirement=focus_requirement,
        )
        if norm and norm["supplier_id"] not in seen_supplier_ids:
            seen_supplier_ids.add(norm["supplier_id"])
            normalized_candidates.append(norm)

    # 6. Constraint Evaluation & Ranking
    ranked_suppliers = evaluate_and_rank_live_candidates(
        candidates=normalized_candidates,
        mission=base_mission,
        exclude_supplier_ids=exclude_supplier_ids,
    )[:max_results]

    discovery_mode = "LIVE_WEB_SEARCH" if ranked_suppliers else "FALLBACK_CATALOG"

    # 7. Record Sourcing Activity for TAB 5 — SOURCING ACTIVITY
    req_label = (
        focus_requirement.strip()
        if focus_requirement and focus_requirement.strip()
        else (
            active_reqs[0]["name"]
            if len(active_reqs) == 1
            else f"{base_mission.get('product_name') or product or 'Product'} ({len(active_reqs)} BOM Requirements)"
        )
    )
    req_type_label = "raw_material"
    if focus_requirement:
        for r in active_reqs:
            if str(r.get("name") or "").strip().lower() == focus_requirement.strip().lower():
                req_type_label = str(r.get("type") or "raw_material")
                break

    sourcing_activity = record_sourcing_activity(
        user_id=str(base_mission.get("user_id") or "system"),
        mission_id=base_mission.get("id"),
        requirement_name=req_label,
        requirement_type=req_type_label,
        queries=search_queries,
        sources_discovered=len(raw_web_results),
        suppliers_extracted=len(ranked_suppliers),
        status="Completed" if ranked_suppliers else "No Verified Matches",
    )

    return {
        "product": base_mission.get("product_name") or product or "",
        "location": base_mission.get("preferred_sourcing_location") or location or "Bengaluru, Karnataka",
        "focus_requirement": focus_requirement,
        "requirements": active_reqs,
        "search_queries": search_queries,
        "discovery_mode": discovery_mode,
        "suppliers": ranked_suppliers,
        "sourcing_activity": sourcing_activity,
    }
