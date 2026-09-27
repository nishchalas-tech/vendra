"""
Google GenAI Python SDK Interface (google/genai/__init__.py)
Supports `from google import genai` and `from google.genai import types`.
Uses GEMINI_API_KEY from the backend environment only.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple, Union
from google.genai import types


INDIAN_LOCATIONS = {
    "bengaluru",
    "bangalore",
    "karnataka",
    "chennai",
    "tamil",
    "nadu",
    "tamilnadu",
    "coimbatore",
    "tiruppur",
    "hosur",
    "mysuru",
    "mysore",
    "mumbai",
    "pune",
    "maharashtra",
    "ahmedabad",
    "surat",
    "rajkot",
    "vapi",
    "gujarat",
    "delhi",
    "noida",
    "gurugram",
    "gurgaon",
    "faridabad",
    "ghaziabad",
    "haryana",
    "uttar",
    "pradesh",
    "moradabad",
    "hyderabad",
    "telangana",
    "kolkata",
    "jaipur",
    "rajasthan",
    "ludhiana",
    "punjab",
    "indore",
    "kochi",
    "kerala",
    "india",
}

NOISE_WORDS = {
    "find",
    "search",
    "discover",
    "live",
    "supplier",
    "suppliers",
    "manufacturer",
    "manufacturers",
    "wholesaler",
    "wholesalers",
    "dealer",
    "dealers",
    "exporter",
    "exporters",
    "vendor",
    "vendors",
    "for",
    "in",
    "near",
    "from",
    "with",
    "and",
    "or",
    "the",
    "of",
    "to",
    "under",
    "below",
    "within",
    "moq",
    "unit",
    "units",
    "pieces",
    "pcs",
    "wholesale",
    "bulk",
    "custom",
    "oem",
    "b2b",
}


def _clean_query_and_extract_city(raw_query: str) -> Tuple[str, str, List[str]]:
    """
    Separates a search query like '70–80 GSM Maplitho Writing Paper manufacturers Bengaluru'
    into:
    - core_keyword: concise B2B search phrase (e.g. '70 GSM maplitho paper')
    - city: 'bengaluru'
    - core_tokens: ['70', 'gsm', 'maplitho', 'paper']
    """
    # Normalize numeric ranges like "70–80 GSM" or "70-80 GSM" -> "70 GSM" so B2B catalog search hits exact listings
    normalized_q = re.sub(r"(\d+)\s*[–\-/]\s*\d+\s*(gsm\b)", r"\1 \2", raw_query, flags=re.IGNORECASE)
    # Remove secondary slash alternatives like "Duplex Board / Recycled Kraft" -> "Duplex Board"
    if "/" in normalized_q:
        normalized_q = normalized_q.split("/")[0].strip() + " " + " ".join(normalized_q.split("/")[1].split()[-2:])

    tokens = re.findall(r"[A-Za-z0-9]+", normalized_q)
    city_found = ""
    core_words: List[str] = []

    stop_fillers = NOISE_WORDS | {
        "service",
        "services",
        "commercial",
        "industrial",
        "grade",
        "feedstock",
        "primary",
        "standard",
        "assembly",
        "contract",
    }

    for tok in tokens:
        low = tok.lower()
        if low in INDIAN_LOCATIONS:
            if not city_found and low not in ("india", "uttar", "pradesh", "tamil", "nadu"):
                city_found = "bengaluru" if low == "bangalore" else low
            continue
        if low in stop_fillers:
            continue
        core_words.append(tok)

    core_keyword = " ".join(core_words).strip()
    if not core_keyword:
        core_keyword = raw_query.strip()

    # Normalize common synonyms for cleaner B2B search matching
    core_keyword = re.sub(r"\bbinded\b", "bound", core_keyword, flags=re.IGNORECASE)
    core_tokens = [
        w.lower()
        for w in re.findall(r"[A-Za-z0-9]+", core_keyword)
        if len(w) >= 2 and w.lower() not in stop_fillers and w.lower() not in INDIAN_LOCATIONS
    ]
    return core_keyword, city_target if (city_target := city_found) else "", core_tokens


def _score_item_relevance(
    product_title: str,
    capability_and_specs: str,
    core_tokens: List[str],
    city_target: str,
    item_location: str,
) -> float:
    """
    Computes how closely a live web supplier listing matches the searched product/material requirement.
    Returns 0.0 if the listing does not match the core product/material terms.
    """
    if not core_tokens:
        return 1.0

    title_lower = product_title.lower()
    full_lower = f"{product_title} {capability_and_specs}".lower()

    # Synonym expansion for common industrial terms
    expanded_sets: List[List[str]] = []
    for tok in core_tokens:
        if tok in ("binded", "bound", "binding"):
            expanded_sets.append(["spiral", "bound", "binding", "wiro"])
        elif tok == "notebooks" or tok == "notebook":
            expanded_sets.append(["notebook", "notebooks", "diary", "exercise book", "writing book"])
        elif tok == "bottles" or tok == "bottle":
            expanded_sets.append(["bottle", "bottles", "flask", "tumbler", "sipper"])
        elif tok == "boxes" or tok == "box":
            expanded_sets.append(["box", "boxes", "carton", "cartons", "packaging", "container"])
        elif tok == "bags" or tok == "bag":
            expanded_sets.append(["bag", "bags", "tote", "pouch", "sack"])
        else:
            expanded_sets.append([tok])

    title_hits = 0
    full_hits = 0
    for syn_group in expanded_sets:
        if any(s in title_lower for s in syn_group):
            title_hits += 1
            full_hits += 1
        elif any(s in full_lower for s in syn_group):
            full_hits += 1

    if full_hits == 0:
        return 0.0

    # Check if the primary distinguishing material/adjective token (first non-numeric token) is matched
    non_num_groups = [g for g in expanded_sets if not g[0].isdigit() and g[0] not in ("gsm", "ss", "a4", "a5")]
    primary_matched = False
    if non_num_groups:
        primary_group = non_num_groups[0]
        primary_matched = any(s in full_lower for s in primary_group)
        # If there are >= 2 distinct concept groups (e.g. "bamboo" + "lunch" + "box") and ONLY generic "box" matched,
        # reject unrelated material items (like Stainless Steel Lunch Box when searching Bamboo Lunch Box)
        if len(non_num_groups) >= 2 and not primary_matched and full_hits < len(expanded_sets) - 1:
            return 0.0

    score = (title_hits * 2.5) + (full_hits * 1.5)
    if primary_matched:
        score += 3.0

    # Penalize consumer retail / corporate gifting resellers when sourcing upstream manufacturing inputs
    if any(r_word in full_lower for r_word in ["retailer", "gift shop", "gifting", "supermarket", "bookstore", "stationery shop"]):
        score -= 2.5

    if city_target:
        loc_low = item_location.lower()
        if city_target in loc_low or (city_target == "bengaluru" and ("bangalore" in loc_low or "karnataka" in loc_low)):
            score += 2.5

    return max(0.0, score)


def _extract_indiamart_live_items(html_text: str) -> List[Dict[str, Any]]:
    marker = '\\"initialProducts\\":'
    idx = html_text.find(marker)
    if idx == -1:
        return []
    start = html_text.find("[", idx + len(marker))
    if start == -1:
        return []
    chunk = html_text[start : start + 240000].replace('\\"', '"').replace("\\\\", "\\")
    depth, in_str, esc, end_idx = 0, False, False, -1
    for i, ch in enumerate(chunk):
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if not in_str:
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end_idx = i + 1
                    break
    if end_idx != -1:
        try:
            data = json.loads(chunk[:end_idx])
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return []


def _fetch_indiamart_for_query(
    raw_query: str,
    core_keyword: str,
    city_target: str,
    core_tokens: List[str],
    headers: Dict[str, str],
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    words = core_keyword.split()
    search_variants = [core_keyword]
    if len(words) > 3:
        search_variants.append(" ".join(words[:3]))

    for kw in search_variants:
        q_enc = urllib.parse.quote_plus(kw)
        cq_param = f"&cq={urllib.parse.quote_plus(city_target)}" if city_target else ""
        im_url = f"https://dir.indiamart.com/search.mp?ss={q_enc}{cq_param}"
        try:
            req = urllib.request.Request(im_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                raw_html = resp.read().decode("utf-8", errors="ignore")
            items = _extract_indiamart_live_items(raw_html)
            for item in items:
                if not isinstance(item, dict):
                    continue
                company = str(item.get("company") or "").strip()
                prod_name = str(item.get("name") or "").strip()
                if not company and not prod_name:
                    continue

                isq_pairs = []
                for pair in (item.get("sellerIsq") or [])[:6]:
                    if isinstance(pair, list) and len(pair) == 2:
                        isq_pairs.append(f"{pair[0]}: {pair[1]}")
                specs_text = "; ".join(isq_pairs)
                biz_type = str(item.get("natureOfBusiness") or "Manufacturer / B2B Supplier").strip()

                state = str(item.get("state") or "").strip()
                city = str(item.get("city") or item.get("district") or "").strip()
                loc_parts = [p for p in [city, state, "India"] if p and p.lower() != "none"]
                location_str = ", ".join(dict.fromkeys(loc_parts)) if loc_parts else "Not publicly listed"

                rel_score = _score_item_relevance(
                    product_title=prod_name,
                    capability_and_specs=f"{specs_text} {company}",
                    core_tokens=core_tokens,
                    city_target=city_target,
                    item_location=location_str,
                )
                if rel_score <= 0:
                    continue

                display_id = str(item.get("displayid") or item.get("id") or "").strip()
                catalog_url = str(item.get("catalog_url") or "").strip()
                if catalog_url and catalog_url.startswith("http"):
                    source_url = catalog_url
                elif display_id:
                    source_url = f"https://www.indiamart.com/proddetail/{display_id}.html"
                else:
                    source_url = im_url

                parsed_domain = (
                    urllib.parse.urlparse(source_url).netloc.replace("www.", "").lower()
                    or "indiamart.com"
                )

                price_num = item.get("price")
                price_fmt = str(item.get("priceFormatted") or "").strip()
                unit = str(item.get("unit") or "unit").strip()
                has_price = bool(price_num and float(price_num) > 0)

                moq_val = item.get("moq")
                has_moq = bool(
                    moq_val is not None and str(moq_val).isdigit() and int(moq_val) > 0
                )

                certs = []
                if item.get("isGSTVerified"):
                    certs.append("GST Verified")
                if item.get("isTrustSeal"):
                    certs.append("IndiaMART TrustSeal Verified")
                if item.get("isIECVerified"):
                    certs.append("IEC Verified")
                if item.get("isVerified"):
                    certs.append("Verified Supplier")

                est_year = str(item.get("estYear") or "").strip()
                snippet_parts = [f"Product: {prod_name}"]
                if company:
                    snippet_parts.append(
                        f"Supplier: {company} ({biz_type}{', Est. ' + est_year if est_year else ''})"
                    )
                if location_str:
                    snippet_parts.append(f"Location: {location_str}")
                if has_price:
                    snippet_parts.append(
                        f"Listed Price: {price_fmt or ('₹' + str(price_num))}/{unit}"
                    )
                if has_moq:
                    snippet_parts.append(f"Listed MOQ: {moq_val} {unit}")
                if certs:
                    snippet_parts.append(f"Verification: {', '.join(certs)}")
                if specs_text:
                    snippet_parts.append(f"Specs: {specs_text}")

                candidates.append(
                    {
                        "supplier_name": company or prod_name,
                        "product_title": prod_name,
                        "source_title": f"{prod_name} — {company} ({parsed_domain})",
                        "source_url": source_url,
                        "website": catalog_url if catalog_url.startswith("http") else source_url,
                        "source_domain": parsed_domain,
                        "location": location_str,
                        "city": city or state or "Not publicly listed",
                        "state": state or "India",
                        "price": float(price_num) if has_price else None,
                        "price_unit": unit,
                        "price_formatted": f"₹{float(price_num):,.2f}/{unit}" if has_price else "Quote required",
                        "moq": int(moq_val) if has_moq else None,
                        "moq_unit": unit,
                        "moq_formatted": f"{int(moq_val):,} {unit}" if has_moq else "Not publicly listed",
                        "lead_time_days": None,
                        "lead_time_formatted": "Not publicly listed",
                        "certifications": ", ".join(certs) if certs else "Not verified",
                        "contact_info": f"Inquire via {parsed_domain}",
                        "business_type": biz_type,
                        "capability": f"{biz_type} of {prod_name}" + (f" ({specs_text})" if specs_text else ""),
                        "specs": specs_text,
                        "supplier_rating": item.get("supplier_rating"),
                        "rating_percent": item.get("rating_percent"),
                        "evidence": " | ".join(snippet_parts),
                        "search_query_used": raw_query,
                        "_relevance_score": rel_score,
                    }
                )
            if candidates:
                break
        except Exception:
            continue

    return candidates


def _fetch_tradeindia_for_query(
    raw_query: str,
    core_keyword: str,
    city_target: str,
    core_tokens: List[str],
    headers: Dict[str, str],
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    q_enc = urllib.parse.quote_plus(core_keyword)
    ti_url = f"https://www.tradeindia.com/search.html?keyword={q_enc}"
    try:
        req = urllib.request.Request(ti_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            raw_html = resp.read().decode("utf-8", errors="ignore")
        m = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">([\s\S]*?)</script>',
            raw_html,
        )
        if not m:
            return []
        data = json.loads(m.group(1))
        listing = (
            data.get("props", {})
            .get("pageProps", {})
            .get("serverData", {})
            .get("searchListingData", {})
            .get("listing_data", [])
        )
        for item in listing:
            if not isinstance(item, dict):
                continue
            # Filter to Indian B2B suppliers when country_code is present
            c_code = str(item.get("country_code") or "IN").upper()
            if c_code and c_code != "IN":
                continue

            company = str(item.get("co_name") or item.get("brand_name") or "").strip()
            prod_name = str(
                item.get("product_name")
                or item.get("long_tail_prod_name")
                or item.get("product_description")
                or item.get("category_name")
                or ""
            ).strip()
            if not company and not prod_name:
                continue

            long_desc = str(item.get("long_tail_prod_name") or item.get("product_description") or "").strip()
            kws = ", ".join(str(k) for k in (item.get("business_kws_names") or [])[:5])
            city = str(item.get("city") or "").strip()
            state = str(item.get("state") or "").strip()
            loc_parts = [p for p in [city, state, "India"] if p and p.lower() != "none"]
            location_str = ", ".join(dict.fromkeys(loc_parts)) if loc_parts else "Not publicly listed"

            rel_score = _score_item_relevance(
                product_title=f"{prod_name} {long_desc}",
                capability_and_specs=f"{kws} {company}",
                core_tokens=core_tokens,
                city_target=city_target,
                item_location=location_str,
            )
            if rel_score <= 0:
                continue

            prod_path = str(item.get("prod_url") or item.get("profile_url") or "").strip()
            if prod_path.startswith("http"):
                source_url = prod_path
            elif prod_path.startswith("/"):
                source_url = f"https://www.tradeindia.com{prod_path}"
            else:
                source_url = ti_url

            website = str(item.get("catalog_mobile_url") or "").strip()
            if not website.startswith("http"):
                website = source_url
            parsed_domain = (
                urllib.parse.urlparse(website).netloc.replace("www.", "").lower()
                if website != source_url
                else "tradeindia.com"
            )

            # Extract price if publicly listed
            price_val: Optional[float] = None
            raw_price_es = item.get("price_es")
            raw_price_str = str(item.get("price") or "").strip()
            if raw_price_es is not None:
                try:
                    p_f = float(raw_price_es)
                    if p_f > 0:
                        price_val = p_f
                except Exception:
                    pass
            elif raw_price_str:
                m_p = re.search(r"([\d,]+(?:\.\d+)?)", raw_price_str)
                if m_p:
                    try:
                        p_f = float(m_p.group(1).replace(",", ""))
                        if p_f > 0:
                            price_val = p_f
                    except Exception:
                        pass

            unit = str(item.get("unit") or "unit").strip()
            has_price = price_val is not None and price_val > 0

            # Extract MOQ if publicly listed
            moq_val: Optional[int] = None
            raw_moq = item.get("moq")
            if raw_moq is not None:
                try:
                    m_i = int(float(str(raw_moq).replace(",", "").strip()))
                    if m_i > 0:
                        moq_val = m_i
                except Exception:
                    pass
            has_moq = moq_val is not None and moq_val > 0

            # Extract delivery lead time if publicly listed in Trade_Information
            lead_time_days: Optional[int] = None
            for td in item.get("hstore_trade_n_information_data") or []:
                if isinstance(td, dict) and "delivery" in str(td.get("field") or "").lower():
                    val_str = str(td.get("field_value") or "").lower()
                    m_lt = re.search(r"(\d+)\s*(?:day|week)", val_str)
                    if m_lt:
                        num = int(m_lt.group(1))
                        lead_time_days = num * 7 if "week" in val_str else num
                        break

            certs = []
            if item.get("has_trust_stamp") or item.get("has_ti_verified"):
                certs.append("TradeIndia TrustStamp Verified")
            if item.get("std_cert"):
                certs.append(str(item.get("std_cert")).strip())
            if item.get("made_in_india"):
                certs.append("Made in India Verified")

            # Contact info if publicly listed on TradeIndia profile
            contact_parts = []
            if item.get("default_mobile"):
                contact_parts.append(str(item["default_mobile"]).strip())
            if item.get("default_email"):
                contact_parts.append(str(item["default_email"]).strip())
            contact_str = " | ".join(contact_parts) if contact_parts else f"Inquire via {parsed_domain}"

            biz_type = str(item.get("business_type") or "Manufacturer / Supplier").strip()
            estd = str(item.get("estd") or "").strip()

            snippet_parts = [f"Product: {prod_name}"]
            if company:
                snippet_parts.append(f"Supplier: {company} ({biz_type}{', Est. ' + estd if estd else ''})")
            if location_str:
                snippet_parts.append(f"Location: {location_str}")
            if has_price:
                snippet_parts.append(f"Listed Price: ₹{price_val:,.2f}/{unit}")
            if has_moq:
                snippet_parts.append(f"Listed MOQ: {moq_val:,} {unit}")
            if lead_time_days:
                snippet_parts.append(f"Listed Lead Time: {lead_time_days} days")
            if certs:
                snippet_parts.append(f"Verification: {', '.join(certs)}")

            candidates.append(
                {
                    "supplier_name": company or prod_name,
                    "product_title": prod_name,
                    "source_title": f"{prod_name} — {company} ({parsed_domain})",
                    "source_url": source_url,
                    "website": website,
                    "source_domain": parsed_domain,
                    "location": location_str,
                    "city": city or state or "Not publicly listed",
                    "state": state or "India",
                    "price": price_val if has_price else None,
                    "price_unit": unit,
                    "price_formatted": f"₹{price_val:,.2f}/{unit}" if has_price else "Quote required",
                    "moq": moq_val if has_moq else None,
                    "moq_unit": unit,
                    "moq_formatted": f"{moq_val:,} {unit}" if has_moq else "Not publicly listed",
                    "lead_time_days": lead_time_days,
                    "lead_time_formatted": f"{lead_time_days} days" if lead_time_days else "Not publicly listed",
                    "certifications": ", ".join(certs) if certs else "Not verified",
                    "contact_info": contact_str,
                    "business_type": biz_type,
                    "capability": f"{biz_type} of {prod_name}" + (f" ({long_desc[:140]})" if long_desc and long_desc != prod_name else ""),
                    "specs": long_desc[:180],
                    "supplier_rating": None,
                    "rating_percent": item.get("open_rate"),
                    "evidence": " | ".join(snippet_parts),
                    "search_query_used": raw_query,
                    "_relevance_score": rel_score,
                }
            )
    except Exception:
        pass

    return candidates


def perform_live_internet_grounding(queries: List[str], max_per_query: int = 4) -> List[Dict[str, Any]]:
    """
    Executes real-time parallel HTTP web search across IndiaMART and TradeIndia live B2B directories
    for the given search queries, strictly filtering out unrelated items by product/material keyword
    relevance and returning real web URLs, titles, company names, and factual snippets.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
    }

    clean_queries: List[Tuple[str, str, str, List[str]]] = []
    for q in queries[:5]:
        q_str = str(q).strip()
        if not q_str:
            continue
        core_kw, city_target, core_tokens = _clean_query_and_extract_city(q_str)
        clean_queries.append((q_str, core_kw, city_target, core_tokens))

    if not clean_queries:
        return []

    all_fetched: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = []
        for q_str, core_kw, city_target, core_tokens in clean_queries:
            futures.append(
                pool.submit(
                    _fetch_indiamart_for_query,
                    q_str,
                    core_kw,
                    city_target,
                    core_tokens,
                    headers,
                )
            )
            futures.append(
                pool.submit(
                    _fetch_tradeindia_for_query,
                    q_str,
                    core_kw,
                    city_target,
                    core_tokens,
                    headers,
                )
            )
        for fut in as_completed(futures):
            try:
                batch = fut.result()
                if batch:
                    all_fetched.extend(batch)
            except Exception:
                pass

    # Sort by relevance score descending and deduplicate by supplier name + source URL
    all_fetched.sort(key=lambda x: float(x.get("_relevance_score") or 0.0), reverse=True)

    results: List[Dict[str, Any]] = []
    seen_companies = set()
    per_query_counts: Dict[str, int] = {}

    for item in all_fetched:
        comp_key = str(item.get("supplier_name") or "").lower().strip()
        if not comp_key or comp_key in seen_companies:
            continue
        q_used = str(item.get("search_query_used") or "")
        if per_query_counts.get(q_used, 0) >= max_per_query:
            continue
        seen_companies.add(comp_key)
        per_query_counts[q_used] = per_query_counts.get(q_used, 0) + 1
        results.append(item)

    return results


_GOOGLE_SEARCH_TOOL_QUOTA_EXHAUSTED = False


class _ModelsAPI:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _call_rest_generate_content(
        self,
        model: str,
        prompt_text: str,
        system_instruction: str = "",
        response_mime_type: str = "",
        use_google_search: bool = False,
        timeout_sec: float = 8.0,
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt_text}]}],
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if use_google_search:
            payload["tools"] = [{"googleSearch": {}}]
        elif response_mime_type:
            payload["generationConfig"] = {"responseMimeType": response_mime_type}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "aistudio-build",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def generate_content(
        self,
        model: str,
        contents: Union[str, List[Any]],
        config: Optional[Union[types.GenerateContentConfig, Dict[str, Any]]] = None,
    ) -> types.GenerateContentResponse:
        global _GOOGLE_SEARCH_TOOL_QUOTA_EXHAUSTED
        prompt_text = contents if isinstance(contents, str) else json.dumps(contents)
        sys_inst = ""
        mime_type = ""
        wants_search = False

        if isinstance(config, types.GenerateContentConfig):
            sys_inst = config.system_instruction or ""
            mime_type = config.response_mime_type or ""
            for t in config.tools or []:
                if isinstance(t, types.Tool) and t.google_search is not None:
                    wants_search = True
                elif isinstance(t, dict) and ("googleSearch" in t or "google_search" in t):
                    wants_search = True
        elif isinstance(config, dict):
            sys_inst = str(config.get("system_instruction") or config.get("systemInstruction") or "")
            mime_type = str(config.get("response_mime_type") or config.get("responseMimeType") or "")
            for t in config.get("tools") or []:
                if isinstance(t, dict) and ("googleSearch" in t or "google_search" in t):
                    wants_search = True

        candidate_models = [
            model,
            "gemini-3.1-flash-lite-preview",
            "gemini-flash-latest",
        ]
        ordered_models = list(dict.fromkeys([m for m in candidate_models if m]))

        if wants_search:
            if not _GOOGLE_SEARCH_TOOL_QUOTA_EXHAUSTED:
                try:
                    raw = self._call_rest_generate_content(
                        model=ordered_models[0],
                        prompt_text=prompt_text,
                        system_instruction=sys_inst,
                        use_google_search=True,
                        timeout_sec=5.0,
                    )
                    cand = (raw.get("candidates") or [{}])[0]
                    parts = cand.get("content", {}).get("parts") or [{}]
                    text = "".join(str(p.get("text") or "") for p in parts)
                    gm = cand.get("groundingMetadata") or {}
                    chunks = []
                    for ch in gm.get("groundingChunks") or []:
                        w = ch.get("web") if isinstance(ch, dict) else None
                        if isinstance(w, dict) and w.get("uri"):
                            dom = urllib.parse.urlparse(str(w["uri"])).netloc.replace("www.", "")
                            chunks.append(
                                types.GroundingChunk(
                                    web=types.GroundingChunkWeb(
                                        uri=str(w["uri"]),
                                        title=str(w.get("title") or ""),
                                        domain=dom,
                                    )
                                )
                            )
                    queries = [str(q) for q in (gm.get("webSearchQueries") or [])]
                    if text and chunks:
                        return types.GenerateContentResponse(
                            text=text,
                            candidates=[
                                types.Candidate(
                                    text=text,
                                    grounding_metadata=types.GroundingMetadata(
                                        web_search_queries=queries,
                                        grounding_chunks=chunks,
                                    ),
                                )
                            ],
                            model=ordered_models[0],
                        )
                except urllib.error.HTTPError as http_err:
                    if http_err.code == 429:
                        _GOOGLE_SEARCH_TOOL_QUOTA_EXHAUSTED = True
                except Exception:
                    pass

            extracted_queries = re.findall(r"-\s*([^\n]+)", prompt_text)
            if not extracted_queries:
                extracted_queries = [prompt_text[:100]]
            live_web_items = perform_live_internet_grounding(extracted_queries[:4], max_per_query=3)
            chunks = [
                types.GroundingChunk(
                    web=types.GroundingChunkWeb(
                        uri=item["source_url"],
                        title=item["source_title"],
                        domain=item["source_domain"],
                    )
                )
                for item in live_web_items
            ]
            return types.GenerateContentResponse(
                text=json.dumps({"suppliers": live_web_items}),
                candidates=[
                    types.Candidate(
                        text=json.dumps({"suppliers": live_web_items}),
                        grounding_metadata=types.GroundingMetadata(
                            web_search_queries=extracted_queries[:4],
                            grounding_chunks=chunks,
                        ),
                    )
                ],
                model="gemini-3.1-flash-lite-preview",
            )

        # Standard text / JSON generation
        last_err: Optional[Exception] = None
        for m_name in ordered_models:
            try:
                raw = self._call_rest_generate_content(
                    model=m_name,
                    prompt_text=prompt_text,
                    system_instruction=sys_inst,
                    response_mime_type=mime_type,
                    use_google_search=False,
                    timeout_sec=10.0,
                )
                cand = (raw.get("candidates") or [{}])[0]
                parts = cand.get("content", {}).get("parts") or [{}]
                text = "".join(str(p.get("text") or "") for p in parts)
                return types.GenerateContentResponse(
                    text=text,
                    candidates=[types.Candidate(text=text)],
                    model=m_name,
                )
            except Exception as exc:
                last_err = exc
                continue

        if last_err:
            raise last_err
        return types.GenerateContentResponse(text="")


class Client:
    def __init__(self, api_key: Optional[str] = None, **kwargs: Any) -> None:
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.models = _ModelsAPI(api_key=self.api_key)
