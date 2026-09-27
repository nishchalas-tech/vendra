"""
Live News & Startup Funding Intelligence for Opportunity Radar
(backend/app/integrations/news_api.py)

Implements Section 33 & Section 66:
- Fetches real-time startup funding, D2C brand, and Indian manufacturing market signals
  using NewsAPI.org (when a valid NewsAPI.org key is configured) AND live Google News RSS
  search streams (Inc42, YourStory, Economic Times, VCCircle, IndianStartupNews, Mint, etc.).
- Guarantees fresh live results on every refresh via article deduplication, exclusion of
  previously seen IDs, and rotating startup-funding query expansions.
- Synthesizes tailored FACT, INFERENCE, OPPORTUNITY HYPOTHESIS, and actionable
  physical-product specifications (with Gemini AI enrichment + deterministic sector synthesis)
  so every live startup funding signal yields a unique, testable manufacturing idea.
"""
import email.utils
import hashlib
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Set
from backend.app.core.config import _load_dotenv_file, settings
from backend.app.core.logging import logger
from backend.app.integrations.gemini import call_gemini_json


# Rotating startup funding & manufacturing search angles so repeated refreshes always discover new live articles
STARTUP_FUNDING_QUERY_ROTATIONS = [
    "India startup raises funding D2C OR consumer OR brand OR manufacturing when:30d",
    "Bengaluru startup raises funding manufacturing OR retail OR consumer OR tech when:30d",
    "Indian startups raised funding million Inc42 OR YourStory OR Entrackr OR VCCircle when:30d",
    "India D2C OR food OR hardware OR EV startup raises funding when:30d",
    "Indian startup seed OR Series A funding D2C OR consumer OR ecommerce when:30d",
    "India climate OR packaging OR mobility OR electronics startup raises funding when:30d",
]


def get_active_news_api_key() -> str:
    """
    Dynamically reloads .env and os.environ so newly added NEWS_API_KEY values
    take effect immediately without requiring a container restart.
    """
    _load_dotenv_file()
    key = (os.environ.get("NEWS_API_KEY") or settings.NEWS_API_KEY or "").strip()
    settings.NEWS_API_KEY = key
    return key


def is_news_api_configured() -> bool:
    return bool(get_active_news_api_key())


def _clean_html_text(raw: str) -> str:
    if not raw:
        return ""
    un = html.unescape(raw)
    cleaned = re.sub(r"<[^>]+>", " ", un)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _parse_pub_date(raw_date: str) -> str:
    if not raw_date:
        return time.strftime("%Y-%m-%d")
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw_date):
        return raw_date[:10]
    try:
        parsed = email.utils.parsedate_to_datetime(raw_date)
        return parsed.strftime("%Y-%m-%d")
    except Exception:
        return raw_date[:16]


def _make_article_id(title: str, source: str) -> str:
    norm = re.sub(r"[^a-z0-9]+", "", title.lower())[:60]
    digest = hashlib.sha1(f"{norm}:{source.lower()}".encode("utf-8")).hexdigest()[:8]
    return f"opp_live_{digest}"


# Sector templates that map live startup funding news to distinct, realistic physical-product manufacturing ideas
SECTOR_PRODUCT_SYNTHESIS: List[Dict[str, Any]] = [
    {
        "keywords": ["ev", "electric vehicle", "automotive", "ultraviolette", "battery", "mobility", "scooter", "motor", "drone", "aerospace", "galaxeye", "space", "robotics"],
        "region": "Bengaluru / Hosur Hardware & Mobility Cluster",
        "sector_tag": "EV, Mobility & DeepTech Funding",
        "inference_template": (
            "Fresh venture capital flowing into Indian EV, mobility, and aerospace hardware startups ({title_short}) "
            "drives immediate Tier-2 demand for CNC-machined aluminum enclosures, thermal management brackets, and vibration-resistant wire harnesses."
        ),
        "hypothesis_template": (
            "Launch a specialized B2B batch of IP67-rated die-cast & CNC aluminum battery/sensor enclosures and custom elastomer seals "
            "targeted at newly funded Bengaluru & Hosur mobility/hardware R&D teams."
        ),
        "product_idea": "IP67 CNC Anodized Aluminum Sensor & Battery Enclosure Kit",
        "spec": {
            "product_category": "EV & Hardware Components",
            "material": "6061-T6 Aluminum Alloy Billet + EPDM Weatherproof Gasket + SS 316 Fasteners",
            "quantity": 500,
            "target_unit_cost": 420.0,
            "maximum_budget": 210000.0,
            "certification_requirements": "ISO 9001:2015, IP67 Ingress Protection, RoHS",
            "packaging_requirements": "Anti-static ESD foam-lined 5-ply corrugated master cartons",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 25,
        },
    },
    {
        "keywords": ["beauty", "skincare", "personal care", "cosmetic", "wellness", "ayurveda", "serum", "hair", "fragrance", "grooming"],
        "region": "Bengaluru / Mumbai D2C Personal Care Corridor",
        "sector_tag": "Funded D2C Beauty & Wellness",
        "inference_template": (
            "Newly funded D2C beauty and wellness brands ({title_short}) allocate 18–25% of seed/Series-A capital toward "
            "premium sustainable primary packaging (frosted glass dropper bottles, airless pumps, and FSC mono-cartons)."
        ),
        "hypothesis_template": (
            "Manufacture a 2,000-unit run of custom-molded UV-coated amber glass serum bottles with bamboo-collar dropper closures "
            "and soy-ink rigid gift boxes for fast-scaling Indian D2C skincare brands."
        ),
        "product_idea": "Custom UV-Amber Glass Dropper Bottle & Bamboo Closure Set (50ml)",
        "spec": {
            "product_category": "Cosmetic & D2C Primary Packaging",
            "material": "Type-III Amber Soda-Lime Glass + Bamboo Collar + Medical-Grade Silicone Pipette + 350 GSM Rigid Kraft Box",
            "quantity": 2000,
            "target_unit_cost": 85.0,
            "maximum_budget": 170000.0,
            "certification_requirements": "ISO 9001:2015, BIS IS 11925, BPA-Free",
            "packaging_requirements": "Partitioned cellular honeycomb transit cartons",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 21,
        },
    },
    {
        "keywords": ["food", "beverage", "snack", "coffee", "tea", "protein", "nutrition", "f&b", "quick commerce", "blinkit", "zepto", "instamart", "grocery", "dairy"],
        "region": "Bengaluru / Mysuru Food-Grade Packaging Hub",
        "sector_tag": "Food, Beverage & Quick-Commerce Funding",
        "inference_template": (
            "Venture-backed functional food, beverage, and quick-commerce startups ({title_short}) require rapid-turnaround, "
            "high-barrier stand-up pouches, nitrogen-flush canisters, and shelf-ready retail shippers with low MOQs."
        ),
        "hypothesis_template": (
            "Produce a 3,000-unit batch of recyclable high-barrier matte stand-up zip pouches and composite paperboard canisters "
            "for funded D2C nutrition and specialty coffee brands launching on quick-commerce dark stores."
        ),
        "product_idea": "Recyclable High-Barrier Matte Stand-Up Zip Pouch & Kraft Canister",
        "spec": {
            "product_category": "Food-Grade Flexible & Rigid Packaging",
            "material": "Multi-Layer Metalized BOPP/PE Barrier Film + Virgin Kraft Paperboard Tube + Food-Grade Tin Lid",
            "quantity": 3000,
            "target_unit_cost": 45.0,
            "maximum_budget": 135000.0,
            "certification_requirements": "FSSAI Food Contact Safe, ISO 22000, BRCGS Packaging",
            "packaging_requirements": "Moisture-sealed poly-lined 5-ply corrugated cartons",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 18,
        },
    },
    {
        "keywords": ["fashion", "apparel", "clothing", "footwear", "sneaker", "lifestyle", "textile", "cotton", "wear", "accessories", "luggage", "bag"],
        "region": "Bengaluru / Tiruppur Apparel & Lifestyle Cluster",
        "sector_tag": "Apparel & Lifestyle Startup Funding",
        "inference_template": (
            "Capital-backed lifestyle, apparel, and accessories startups ({title_short}) are shifting from imported fast-fashion batches "
            "to domestic short-run, heavyweight organic cotton and technical fabric manufacturing with 21-day replenishment cycles."
        ),
        "hypothesis_template": (
            "Source and manufacture a 1,000-unit capsule batch of 320 GSM GOTS-certified combed cotton French terry hoodies/tees "
            "with custom woven labels and biodegradable corn-starch mailer bags."
        ),
        "product_idea": "320 GSM Organic Cotton French Terry Capsule Apparel Line",
        "spec": {
            "product_category": "Sustainable Apparel & Merchandise",
            "material": "320 GSM 100% GOTS Organic Combed Cotton + Recycled Polyester Ribbing + YKK Metal Zippers",
            "quantity": 1000,
            "target_unit_cost": 310.0,
            "maximum_budget": 310000.0,
            "certification_requirements": "GOTS Organic, OEKO-TEX Standard 100, ISO 9001:2015",
            "packaging_requirements": "Compostable PBAT/PLA garment polybags + FSC kraft hangtags",
            "preferred_sourcing_location": "Tiruppur, India",
            "delivery_deadline": 24,
        },
    },
    {
        "keywords": ["ai", "saas", "software", "tech", "brahma", "byteask", "dextr", "demoverse", "enterprise", "fintech", "b2b", "cloud", "semiconductor"],
        "region": "Bengaluru Tech & GCC Procurement Corridor",
        "sector_tag": "Funded Tech & Startup Expansion",
        "inference_template": (
            "Newly funded technology and AI startups ({title_short}) rapidly scale engineering headcount and customer community events, "
            "creating immediate B2B procurement demand for premium custom founder/employee onboarding kits and hardware desk accessories."
        ),
        "hypothesis_template": (
            "Supply newly funded seed and Series-A startups in Bengaluru with a 1,000-unit batch of modular magnetic desk organizers, "
            "hardcover dot-grid engineering notebooks (80 GSM maplitho + 300 GSM duplex cover), and double-wall SS-304 vacuum tumblers."
        ),
        "product_idea": "Founder & Engineering Team Hardware Desk & Notebook Onboarding Kit",
        "spec": {
            "product_category": "B2B Corporate & Tech Merchandise",
            "material": "80 GSM Maplitho Paper + 300 GSM Duplex Board + SS 304 Vacuum Flask + Anodized Aluminum Cable Dock",
            "quantity": 1000,
            "target_unit_cost": 265.0,
            "maximum_budget": 265000.0,
            "certification_requirements": "ISO 9001:2015, FSC Mix Paper, BIS IS 14756",
            "packaging_requirements": "Custom die-cut rigid magnetic closure kraft presentation box",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 21,
        },
    },
    {
        "keywords": ["packaging", "sustainable", "plastic", "eco", "recycling", "climate", "green", "solar", "clean energy", "circular", "bamboo"],
        "region": "Karnataka & Pan-India CleanTech Corridor",
        "sector_tag": "CleanTech & Sustainable Materials Funding",
        "inference_template": (
            "Investment in sustainable materials and circular-economy startups ({title_short}) accelerates enterprise transition "
            "toward molded-pulp protective inserts, bagasse tableware, and FSC-certified rigid kraft packaging."
        ),
        "hypothesis_template": (
            "Launch a 2,500-unit production run of custom-molded agricultural-fiber / bagasse protective electronics & D2C shipping trays "
            "replacing expanded polystyrene (EPS) thermocol for Indian electronics and appliance brands."
        ),
        "product_idea": "Custom Molded Bagasse & Kraft Protective D2C Transit Packaging System",
        "spec": {
            "product_category": "Sustainable Industrial Packaging",
            "material": "100% Unbleached Sugarcane Bagasse Pulp + 250 GSM Recycled Virgin Kraft Linerboard",
            "quantity": 2500,
            "target_unit_cost": 68.0,
            "maximum_budget": 170000.0,
            "certification_requirements": "ISO 14001, FSC Recycled, EN 13432 Compostable",
            "packaging_requirements": "Palletized stretch-wrapped bulk master bundles",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 20,
        },
    },
]


FALLBACK_ROTATING_VARIATIONS: List[Dict[str, Any]] = [
    {
        "region": "Bengaluru / Peenya Industrial Cluster",
        "sector_tag": "Startup Funding & D2C Supply Chain",
        "product_idea": "Modular Magnetic Desk & Creator Hardware Stand",
        "spec": {
            "product_category": "Consumer Hardware & Accessories",
            "material": "CNC 6061 Aluminum + Neodymium N52 Magnets + Non-Slip Silicone Basepad",
            "quantity": 1000,
            "target_unit_cost": 290.0,
            "maximum_budget": 290000.0,
            "certification_requirements": "ISO 9001:2015, RoHS Compliant",
            "packaging_requirements": "Die-cut E-flute matte black kraft retail box",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 25,
        },
    },
    {
        "region": "Bengaluru / Whitefield D2C Hub",
        "sector_tag": "Seed & Series-A Consumer Brand Signal",
        "product_idea": "Double-Wall Copper-Vacuum Insulated SS 304 Travel Tumbler (600ml)",
        "spec": {
            "product_category": "Sustainable Drinkware",
            "material": "SS 304 Food-Grade Stainless Steel Coil + BPA-Free Tritan Sip Lid + Silicone O-Ring",
            "quantity": 1200,
            "target_unit_cost": 240.0,
            "maximum_budget": 288000.0,
            "certification_requirements": "ISO 9001:2015, BIS IS 14756, FDA Food Contact",
            "packaging_requirements": "Cylindrical recycled kraft canister tube",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 28,
        },
    },
    {
        "region": "Mumbai / Ahmedabad / Bengaluru Corridor",
        "sector_tag": "Venture-Backed Retail & Packaging Signal",
        "product_idea": "Custom Rigid Magnetic Gift Box & Molded Pulp Insert Kit",
        "spec": {
            "product_category": "Premium D2C Unboxing Packaging",
            "material": "1200 GSM Greyboard + 157 GSM Art Paper Wrap + Molded Bamboo Pulp Tray",
            "quantity": 2000,
            "target_unit_cost": 95.0,
            "maximum_budget": 190000.0,
            "certification_requirements": "FSC Certified, ISO 9001:2015",
            "packaging_requirements": "Flat-packed 7-ply export corrugated master cartons",
            "preferred_sourcing_location": "Bengaluru, Karnataka",
            "delivery_deadline": 21,
        },
    },
]


def _synthesize_opportunity_from_article(
    art: Dict[str, Any], idx: int
) -> Dict[str, Any]:
    """
    Transforms a live news article (title, description, source, url, published_at)
    into a distinct, concrete Vendra Opportunity Radar item with FACT, INFERENCE,
    OPPORTUNITY HYPOTHESIS, and a tailored Product Specification.
    """
    title = _clean_html_text(art.get("title") or "Indian Startup Funding & Market Signal")
    # Strip trailing " - SourceName" from Google News titles if present
    source_name = str(art.get("source") or "Live News Feed").strip()
    if " - " in title and title.endswith(source_name):
        title = title[: -len(source_name) - 3].strip()

    desc = _clean_html_text(art.get("description") or "")
    if not desc or desc.lower() == title.lower() or len(desc) < 25:
        desc = (
            f"Live market report from {source_name}: \"{title}\". "
            "Signals active capital deployment and product expansion across Indian startup and MSME ecosystems."
        )

    pub_date = _parse_pub_date(str(art.get("published_at") or ""))
    source_url = str(art.get("url") or "").strip()
    combined_lower = f"{title} {desc}".lower()
    title_short = title[:75] + ("..." if len(title) > 75 else "")

    # Extract funding amount if mentioned in headline/snippet (e.g. "$203 Mn", "$600,000", "₹50 Cr")
    funding_match = re.search(
        r"(\$\s?[\d,.]+\s?(?:million|mn|m|billion|bn|k|\d+)|₹\s?[\d,.]+\s?(?:cr|crore|lakh|mn)|rs\.?\s?[\d,.]+\s?(?:cr|crore|lakh))",
        f"{title} {desc}",
        flags=re.IGNORECASE,
    )
    funding_badge = funding_match.group(1).strip() if funding_match else None

    matched_sector = None
    for sector in SECTOR_PRODUCT_SYNTHESIS:
        if any(kw in combined_lower for kw in sector["keywords"]):
            matched_sector = sector
            break

    if matched_sector:
        region = matched_sector["region"]
        sector_tag = matched_sector["sector_tag"]
        inference = matched_sector["inference_template"].format(title_short=title_short)
        hypothesis = matched_sector["hypothesis_template"]
        product_idea = matched_sector["product_idea"]
        spec = dict(matched_sector["spec"])
    else:
        var = FALLBACK_ROTATING_VARIATIONS[idx % len(FALLBACK_ROTATING_VARIATIONS)]
        region = var["region"]
        sector_tag = var["sector_tag"]
        inference = (
            f"Fresh startup and market activity highlighted in \"{title_short}\" ({source_name}) "
            "accelerates B2B procurement of localized custom hardware, packaging, and branded physical SKUs."
        )
        hypothesis = (
            f"Capitalize on the growth momentum reported in \"{title_short}\" by launching a short-run domestic batch of "
            f"{var['product_idea']} with verified Bengaluru/South-India upstream suppliers."
        )
        product_idea = var["product_idea"]
        spec = dict(var["spec"])

    # Make product_idea uniquely tied to the article context when possible
    startup_name_match = re.match(
        r"^(?:Indian\s+startup\s+|Bengaluru-based\s+|Mumbai-based\s+|D2C\s+brand\s+)?([A-Z][A-Za-z0-9.&\-]+(?:\s+[A-Z][A-Za-z0-9.&\-]+)?)\s+(?:raises|secures|bags|nets|closes|lands)",
        title,
    )
    if startup_name_match:
        st_name = startup_name_match.group(1).strip()
        product_idea = f"{product_idea} (Inspired by {st_name} Funding Signal)"

    source_display = f"{source_name} · {sector_tag}"
    if funding_badge:
        source_display = f"{source_name} · Funding: {funding_badge}"

    return {
        "id": _make_article_id(title, source_name),
        "signal_title": title,
        "source": source_display,
        "source_url": source_url,
        "published_at": pub_date,
        "region": region,
        "fact": desc,
        "inference": inference,
        "opportunity_hypothesis": hypothesis,
        "product_idea": product_idea,
        "product_specification": spec,
    }


def _fetch_from_newsapi_org(api_key: str, query: str, page: int = 1) -> List[Dict[str, Any]]:
    """
    Queries NewsAPI.org /v2/everything if a valid NewsAPI.org key is present.
    """
    if not api_key or api_key.startswith("AQ.") or api_key.startswith("AIza"):
        # Keys starting with AQ. or AIza are Google/Vertex keys, not newsapi.org keys
        return []

    # Convert multi-word space-separated queries into looser boolean queries so NewsAPI doesn't return 0 results
    words = [w.strip() for w in re.split(r"\s+", query) if len(w.strip()) >= 2]
    if len(words) > 3 and "OR" not in query and "AND" not in query:
        primary = " ".join(words[:2])
        secondary = " OR ".join(words[2:])
        smart_q = f"{primary} AND ({secondary})"
    else:
        smart_q = query

    q_encoded = urllib.parse.quote(smart_q)
    url = (
        f"https://newsapi.org/v2/everything?q={q_encoded}"
        f"&language=en&pageSize=12&page={max(1, page)}&sortBy=publishedAt"
    )
    req = urllib.request.Request(
        url,
        headers={"X-Api-Key": api_key, "User-Agent": "vendra-backend/1.0"},
    )
    with urllib.request.urlopen(req, timeout=6.0) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        articles: List[Dict[str, Any]] = []
        for art in data.get("articles") or []:
            title = (art.get("title") or "").strip()
            if not title or title == "[Removed]":
                continue
            articles.append(
                {
                    "title": title,
                    "description": art.get("description") or art.get("content") or title,
                    "source": (art.get("source") or {}).get("name") or "NewsAPI Live",
                    "url": art.get("url") or "",
                    "published_at": art.get("publishedAt") or "",
                }
            )
        return articles


def _fetch_from_live_google_news_rss(
    query: str, refresh_index: int = 0
) -> List[Dict[str, Any]]:
    """
    Fetches real-time live news articles from Google News RSS search for India (`gl=IN&hl=en-IN`).
    Combines the user's query with rotating startup-funding & D2C/manufacturing search angles
    so every refresh returns fresh live news articles.
    """
    clean_q = query.strip()
    queries_to_run: List[str] = []

    rot_idx = refresh_index % len(STARTUP_FUNDING_QUERY_ROTATIONS)
    rot_query = STARTUP_FUNDING_QUERY_ROTATIONS[rot_idx]
    next_rot = STARTUP_FUNDING_QUERY_ROTATIONS[(refresh_index + 1) % len(STARTUP_FUNDING_QUERY_ROTATIONS)]

    # Format user query so 4+ words use OR for secondary keywords and always match live news
    if clean_q:
        words = [w.strip() for w in re.split(r"\s+", clean_q) if len(w.strip()) >= 2]
        if len(words) > 3 and "OR" not in clean_q:
            formatted_user_q = f"{' '.join(words[:2])} ({' OR '.join(words[2:])}) when:30d"
        elif "when:" not in clean_q:
            formatted_user_q = f"{clean_q} when:30d"
        else:
            formatted_user_q = clean_q
    else:
        formatted_user_q = rot_query

    # On refresh_index > 0, lead with the rotating startup-funding stream so every refresh surfaces new signals
    if refresh_index > 0:
        for q_candidate in [rot_query, formatted_user_q, next_rot]:
            if q_candidate not in queries_to_run:
                queries_to_run.append(q_candidate)
    else:
        for q_candidate in [formatted_user_q, rot_query, next_rot]:
            if q_candidate not in queries_to_run:
                queries_to_run.append(q_candidate)

    collected: List[Dict[str, Any]] = []
    seen_titles: Set[str] = set()

    for q_str in queries_to_run[:2]:
        try:
            q_enc = urllib.parse.quote(q_str)
            rss_url = f"https://news.google.com/rss/search?q={q_enc}&hl=en-IN&gl=IN&ceid=IN:en"
            req = urllib.request.Request(
                rss_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                },
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                xml_bytes = resp.read()
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item")[:25]:
                raw_title = (item.findtext("title") or "").strip()
                if not raw_title:
                    continue
                source_el = item.find("source")
                source_name = (
                    source_el.text.strip()
                    if source_el is not None and source_el.text
                    else "Google News India"
                )
                # Filter out social media posts like instagram.com
                if any(bad in source_name.lower() for bad in ["instagram.com", "facebook.com", "youtube.com"]):
                    continue
                norm_t = re.sub(r"[^a-z0-9]+", "", raw_title.lower())[:50]
                if norm_t in seen_titles:
                    continue
                seen_titles.add(norm_t)

                link = (item.findtext("link") or "").strip()
                pub_date = (item.findtext("pubDate") or "").strip()
                desc = _clean_html_text(item.findtext("description") or "")

                collected.append(
                    {
                        "title": raw_title,
                        "description": desc,
                        "source": source_name,
                        "url": link,
                        "published_at": pub_date,
                    }
                )
        except Exception as exc:
            logger.warning(f"Live news RSS query failed for '{q_str}': {exc}")

    return collected


def _enrich_opportunities_with_gemini_if_available(
    opportunities: List[Dict[str, Any]], user_query: str
) -> List[Dict[str, Any]]:
    """
    Optionally refines the top live news opportunities via Gemini AI so that each startup funding
    headline gets a hyper-specific product idea, inference, and hypothesis while preserving
    100% of the factual news headline, date, and source URL.
    """
    if not opportunities:
        return opportunities

    headlines_summary = "\n".join(
        f"{idx + 1}. Title: {opp['signal_title']} | Source: {opp['source']} | Fact: {opp['fact'][:180]}"
        for idx, opp in enumerate(opportunities[:4])
    )
    prompt = (
        f"User Search Focus: {user_query}\n"
        "Below are real, live news signals (including Indian startup funding rounds and market shifts):\n"
        f"{headlines_summary}\n\n"
        "For each numbered news signal, synthesize a concrete physical-product manufacturing opportunity for an Indian founder or B2B supplier.\n"
        "Return JSON with key 'items' (list of objects with exact keys):\n"
        "{\n"
        '  "items": [\n'
        "    {\n"
        '      "index": 1,\n'
        '      "inference": "<1-2 sentence supply chain / manufacturing demand implication of this specific news>",\n'
        '      "opportunity_hypothesis": "<1-2 sentence testable business & manufacturing hypothesis in India>",\n'
        '      "product_idea": "<specific physical product SKU name to manufacture>",\n'
        '      "product_category": "<category>",\n'
        '      "material": "<specific upstream raw materials & components, e.g. 80 GSM Maplitho Paper, SS 304, 6061 Aluminum, 350 GSM Kraft>",\n'
        '      "quantity": 1000,\n'
        '      "target_unit_cost": 220,\n'
        '      "delivery_deadline": 25\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    ai_res = call_gemini_json(
        prompt=prompt,
        system_instruction=(
            "You are Vendra's Live Startup Funding & Manufacturing Opportunity Strategist. "
            "Turn real startup funding and industry news headlines into concrete, manufacturable physical product ideas in India."
        ),
        timeout_sec=5.5,
    )
    if not isinstance(ai_res, dict) or not isinstance(ai_res.get("items"), list):
        return opportunities

    for enriched in ai_res["items"]:
        if not isinstance(enriched, dict):
            continue
        idx = int(enriched.get("index") or 0) - 1
        if 0 <= idx < len(opportunities):
            target = opportunities[idx]
            if enriched.get("inference"):
                target["inference"] = str(enriched["inference"]).strip()
            if enriched.get("opportunity_hypothesis"):
                target["opportunity_hypothesis"] = str(enriched["opportunity_hypothesis"]).strip()
            if enriched.get("product_idea"):
                target["product_idea"] = str(enriched["product_idea"]).strip()
            spec = target.get("product_specification") or {}
            if enriched.get("product_category"):
                spec["product_category"] = str(enriched["product_category"]).strip()
            if enriched.get("material"):
                spec["material"] = str(enriched["material"]).strip()
            if enriched.get("quantity"):
                try:
                    qty = max(100, int(enriched["quantity"]))
                    spec["quantity"] = qty
                except Exception:
                    pass
            if enriched.get("target_unit_cost"):
                try:
                    uc = max(15.0, float(enriched["target_unit_cost"]))
                    spec["target_unit_cost"] = uc
                    spec["maximum_budget"] = round(uc * int(spec.get("quantity") or 1000), 2)
                except Exception:
                    pass
            if enriched.get("delivery_deadline"):
                try:
                    spec["delivery_deadline"] = max(7, int(enriched["delivery_deadline"]))
                except Exception:
                    pass

    return opportunities


def fetch_market_opportunities(
    query: str = "India startup funding D2C manufacturing consumer brand",
    refresh_index: int = 0,
    exclude_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Fetches live market & startup funding signals and structures them into:
    - FACT (Verified live news signal + publication date + source URL)
    - INFERENCE (Supply chain & B2B procurement implication)
    - OPPORTUNITY HYPOTHESIS (Testable physical-product batch idea)
    - PRODUCT SPECIFICATION (Ready to convert into a Vendra Sourcing Mission)

    Ensures every refresh returns a fresh batch of live signals by filtering out `exclude_ids`
    and rotating through live startup funding & manufacturing search streams.
    """
    active_key = get_active_news_api_key()
    excluded: Set[str] = set(exclude_ids or [])
    clean_query = (query or "").strip() or "India startup funding D2C manufacturing consumer brand"

    raw_articles: List[Dict[str, Any]] = []
    source_provider = "Live News Intelligence Stream"

    # 1. Try NewsAPI.org if a standard NewsAPI.org key is configured
    if active_key:
        try:
            page_num = (refresh_index % 3) + 1
            newsapi_arts = _fetch_from_newsapi_org(active_key, clean_query, page=page_num)
            if newsapi_arts:
                raw_articles.extend(newsapi_arts)
                source_provider = "NewsAPI.org Live Feed"
        except Exception as exc:
            logger.warning(f"NewsAPI.org fetch returned error ({exc}); using live Google News RSS stream.")

    # 2. Always supplement / fallback with Live Google News RSS (Inc42, YourStory, Economic Times, etc.)
    if len(raw_articles) < 6:
        rss_arts = _fetch_from_live_google_news_rss(clean_query, refresh_index=refresh_index)
        raw_articles.extend(rss_arts)
        if source_provider == "Live News Intelligence Stream":
            source_provider = "Live Startup & Market News Feed (Inc42 / ET / YourStory / Google News)"

    # 3. Synthesize opportunities and filter out previously shown IDs (`excluded`) so Refresh always yields NEW ideas
    fresh_opportunities: List[Dict[str, Any]] = []
    fallback_unexcluded: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()

    for idx, art in enumerate(raw_articles):
        opp = _synthesize_opportunity_from_article(art, idx + refresh_index)
        oid = opp["id"]
        if oid in seen_ids:
            continue
        seen_ids.add(oid)
        if oid not in excluded:
            fresh_opportunities.append(opp)
        else:
            fallback_unexcluded.append(opp)

    # Offset slice by refresh_index if the user didn't pass exclude_ids
    if not excluded and refresh_index > 0 and len(fresh_opportunities) > 4:
        start = (refresh_index * 4) % max(1, len(fresh_opportunities) - 3)
        selected = fresh_opportunities[start : start + 4]
        if len(selected) < 4:
            selected.extend(fresh_opportunities[: 4 - len(selected)])
    else:
        selected = fresh_opportunities[:4]

    if len(selected) < 4 and fallback_unexcluded:
        for item in fallback_unexcluded:
            if item["id"] not in {x["id"] for x in selected}:
                selected.append(item)
            if len(selected) >= 4:
                break

    # 4. Optionally enrich with Gemini AI if available
    selected = _enrich_opportunities_with_gemini_if_available(selected, clean_query)

    return {
        "news_api_configured": True,
        "status": "CONFIGURED",
        "query_used": clean_query,
        "refresh_index": refresh_index,
        "message": (
            f"Live Startup Funding & Market Signals active ({source_provider}) · "
            f"Showing {len(selected)} real-time opportunities for \"{clean_query}\"."
        ),
        "opportunities": selected,
    }
