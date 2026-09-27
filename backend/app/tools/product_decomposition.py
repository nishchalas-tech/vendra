"""
Product Understanding & Material/Component Decomposition Tool
(backend/app/tools/product_decomposition.py)

Implements Requirement 1 & Upstream Raw-Material Sourcing Architecture:
Product
-> Material / Component Decomposition
-> Requirement Classification (raw_material, component, packaging, process)
-> Supplier Type Classification (RAW_MATERIAL_SUPPLIER, COMPONENT_SUPPLIER, PACKAGING_SUPPLIER, CONTRACT_MANUFACTURER, MANUFACTURER, WHOLESALER)
-> Dynamic B2B Search Queries targeting upstream raw-material & component suppliers rather than retail finished-product sellers.
"""
import re
from typing import Any, Dict, List
from backend.app.integrations.gemini import call_gemini_json


VALID_REQUIREMENT_TYPES = {"raw_material", "component", "packaging", "process"}

REQUIREMENT_TO_SUPPLIER_TYPE = {
    "raw_material": "RAW_MATERIAL_SUPPLIER",
    "component": "COMPONENT_SUPPLIER",
    "packaging": "PACKAGING_SUPPLIER",
    "process": "CONTRACT_MANUFACTURER",
}

INDIAN_CITIES = [
    "Bengaluru",
    "Bangalore",
    "Karnataka",
    "Chennai",
    "Coimbatore",
    "Tiruppur",
    "Hosur",
    "Mysuru",
    "Mumbai",
    "Pune",
    "Ahmedabad",
    "Surat",
    "Delhi",
    "Noida",
    "Gurugram",
    "Faridabad",
    "Moradabad",
    "Hyderabad",
    "Kolkata",
    "Jaipur",
    "Ludhiana",
    "Rajkot",
    "Vapi",
    "Indore",
    "Kochi",
]


def _parse_natural_language_constraints(text: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts product name, quantity, unit cost, budget, deadline, and location from a natural
    language prompt or merges with explicit payload fields.
    Always prioritizes explicit numbers/locations found inside a fresh natural language prompt.
    """
    raw = text.strip()
    lower = raw.lower()

    # 1. Quantity extraction from prompt first, then payload fallback
    prompt_qty = 0
    if raw:
        m_qty = re.search(
            r"(?:manufacture|produce|order|source|need|want|procure|buy|find\s+(?:live\s+)?suppliers?\s+for|create\s+(?:a\s+)?mission\s+for)\s+([\d,]+)\s+(?:units?\s+of\s+)?",
            lower,
        ) or re.search(
            r"\b([\d,]+)\s*(?:units?|pieces|pcs|notebooks?|bottles?|boxes|bags|packs?|shirts?|hoodies?|mugs?|jars?|containers?|kg|tons?|reels?|sheets?)\b",
            lower,
        )
        if m_qty:
            try:
                val = int(m_qty.group(1).replace(",", ""))
                if val > 0 and val not in (70, 80, 300, 304, 316):
                    prompt_qty = val
            except Exception:
                prompt_qty = 0

    qty = prompt_qty or int(payload.get("quantity") or 0) or 1000

    # 2. Target unit cost extraction from prompt first, then payload fallback
    prompt_unit = 0.0
    if raw:
        m_unit = re.search(
            r"(?:under|below|at|target|budget)?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(?:per\s+unit|/unit|each|per\s+piece|/pc|/kg)?",
            lower,
        )
        if m_unit:
            try:
                prompt_unit = float(m_unit.group(1).replace(",", ""))
            except Exception:
                prompt_unit = 0.0

    target_unit = prompt_unit or float(payload.get("target_unit_cost") or 0.0) or 250.0

    # 3. Maximum budget extraction
    max_budget = float(payload.get("maximum_budget") or 0.0)
    if prompt_qty or prompt_unit or max_budget <= 0:
        max_budget = round(qty * target_unit, 2)

    # 4. Deadline extraction from prompt first, then payload fallback
    prompt_deadline = 0
    if raw:
        m_days = re.search(r"(?:within|in|under|deadline|le|<=)\s*(\d+)\s*days?", lower)
        if m_days:
            try:
                prompt_deadline = int(m_days.group(1))
            except Exception:
                prompt_deadline = 0

    deadline = prompt_deadline or int(payload.get("delivery_deadline") or 0) or 30

    # 5. Location extraction from prompt first, then payload fallback
    prompt_location = ""
    if raw:
        for city_candidate in INDIAN_CITIES:
            if re.search(rf"\b{re.escape(city_candidate.lower())}\b", lower):
                prompt_location = (
                    "Bengaluru, Karnataka"
                    if city_candidate.lower() in ("bengaluru", "bangalore")
                    else f"{city_candidate}, India"
                )
                break

    location = (
        prompt_location
        or str(payload.get("preferred_sourcing_location") or payload.get("location") or "").strip()
        or "Bengaluru, Karnataka"
    )

    # 6. Product name extraction
    explicit_product = str(payload.get("product_name") or payload.get("product") or "").strip()
    prompt_product = ""
    if raw:
        cleaned = re.sub(
            r"^(?:i\s+want\s+to\s+|we\s+want\s+to\s+|please\s+|can\s+you\s+)?(?:manufacture|produce|source|make|procure|create\s+(?:a\s+)?mission\s+for|find\s+(?:live\s+)?(?:raw\s+material\s+)?suppliers?\s+for|search\s+(?:live\s+)?suppliers?\s+for|discover\s+(?:live\s+)?suppliers?\s+for|decompose)\s+(?:[\d,]+\s+)?(?:units?\s+of\s+)?",
            "",
            raw,
            flags=re.IGNORECASE,
        )
        cleaned = re.split(
            r"\s+(?:in\s+[A-Za-z]+|under\s+₹|under\s+rs|within\s+\d+\s+days|below\s+₹|with\s+budget|into\s+material|into\s+component)",
            cleaned,
            flags=re.IGNORECASE,
        )[0].strip(" .,")
        cleaned = re.sub(r"^(?:[\d,]+\s+)(?:units?\s+of\s+)?", "", cleaned, flags=re.IGNORECASE).strip()
        prompt_product = cleaned

    if payload.get("prefer_prompt") and prompt_product:
        product_name = prompt_product
    else:
        product_name = explicit_product or prompt_product or raw[:80] or "Custom Product"

    return {
        "product_name": product_name,
        "product_description": str(payload.get("product_description") or raw or product_name).strip(),
        "product_category": str(payload.get("product_category") or "Manufactured Goods").strip(),
        "quantity": qty,
        "target_unit_cost": target_unit,
        "maximum_budget": max_budget,
        "delivery_deadline": deadline,
        "preferred_sourcing_location": location,
        "material": str(payload.get("material") or "").strip(),
        "packaging_requirements": str(payload.get("packaging_requirements") or "").strip(),
        "certification_requirements": str(payload.get("certification_requirements") or "").strip(),
    }


def _build_b2b_queries_for_requirement(name: str, req_type: str, city_short: str) -> List[str]:
    """
    Generates upstream B2B search queries for a specific requirement, avoiding retail/consumer phrasing.
    """
    clean_name = re.sub(r"\([^)]*\)", "", name).strip()
    if req_type == "raw_material":
        return [
            f"{clean_name} manufacturers {city_short}",
            f"{clean_name} wholesalers {city_short}",
            f"{clean_name} B2B suppliers {city_short}",
        ]
    if req_type == "component":
        return [
            f"{clean_name} manufacturers {city_short}",
            f"{clean_name} component suppliers {city_short}",
        ]
    if req_type == "packaging":
        return [
            f"{clean_name} packaging suppliers {city_short}",
            f"{clean_name} manufacturers {city_short}",
        ]
    return [
        f"{clean_name} contract manufacturers {city_short}",
        f"{clean_name} manufacturers {city_short}",
    ]


def _normalize_requirement_item(
    item: Dict[str, Any], default_location: str
) -> Dict[str, Any]:
    req_type = str(item.get("type") or "raw_material").strip().lower()
    if req_type not in VALID_REQUIREMENT_TYPES:
        if "raw" in req_type or "material" in req_type:
            req_type = "raw_material"
        elif "pack" in req_type:
            req_type = "packaging"
        elif "proc" in req_type or "finish" in req_type or "mfg" in req_type or "print" in req_type or "bind" in req_type:
            req_type = "process"
        else:
            req_type = "component"

    name = str(item.get("name") or "").strip()
    purpose = str(item.get("purpose") or f"Upstream {req_type.replace('_', ' ')} for manufacturing").strip()
    loc = str(item.get("location") or default_location or "Bengaluru, Karnataka").strip()
    city_short = loc.split(",")[0].strip()

    raw_terms = item.get("search_terms") or []
    if isinstance(raw_terms, str):
        search_terms = [t.strip() for t in raw_terms.split(",") if t.strip()]
    elif isinstance(raw_terms, list):
        search_terms = [str(t).strip() for t in raw_terms if str(t).strip()]
    else:
        search_terms = []

    # Filter out any retail/shop/buy online queries
    search_terms = [
        t for t in search_terms
        if not any(bad in t.lower() for bad in ["shop ", "shops ", "buy online", "store ", "retail"])
    ]

    if not search_terms and name:
        search_terms = _build_b2b_queries_for_requirement(name, req_type, city_short)

    supplier_category = str(
        item.get("supplier_category")
        or REQUIREMENT_TO_SUPPLIER_TYPE.get(req_type, "RAW_MATERIAL_SUPPLIER")
    ).strip().upper()

    try:
        conf = float(item.get("confidence", 0.94))
        conf = max(0.1, min(1.0, round(conf, 2)))
    except Exception:
        conf = 0.94

    return {
        "name": name,
        "type": req_type,
        "supplier_category": supplier_category,
        "purpose": purpose,
        "search_terms": search_terms[:4],
        "location": loc,
        "confidence": conf,
    }


def _fallback_dynamic_decomposition(
    constraints: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Dynamically derives upstream raw-material, component, packaging, and manufacturing process
    requirements from the mission's actual product name, description, material specification,
    and packaging requirements. Prioritizes upstream raw materials and components over finished goods.
    """
    product = constraints["product_name"]
    desc = constraints["product_description"]
    mat = constraints["material"]
    pack = constraints["packaging_requirements"]
    loc = constraints["preferred_sourcing_location"] or "Bengaluru, Karnataka"
    city = loc.split(",")[0].strip()
    combined_lower = f"{product} {desc} {mat}".lower()

    # Check if the user directly queried a specific raw material or component
    if any(
        kw in product.lower()
        for kw in ["gsm", "maplitho", "duplex", "spiral wire", "binding wire", "coil", "silicone", "corrugated", "kraft", "yarn", "fabric", "sheet", "resin", "granules"]
    ) and not any(w in product.lower() for w in ["notebook", "bottle", "lunch box", "tote bag"]):
        r_type = "raw_material"
        if any(w in product.lower() for w in ["wire", "coil", "cap", "lid", "gasket", "ring", "zipper", "buckle"]):
            r_type = "component"
        elif any(w in product.lower() for w in ["corrugated", "carton", "packaging", "shrink"]):
            r_type = "packaging"
        return [
            {
                "name": product,
                "type": r_type,
                "supplier_category": REQUIREMENT_TO_SUPPLIER_TYPE.get(r_type, "RAW_MATERIAL_SUPPLIER"),
                "purpose": f"Direct B2B upstream procurement of {product}",
                "search_terms": _build_b2b_queries_for_requirement(product, r_type, city),
                "location": loc,
                "confidence": 0.97,
            }
        ]

    # Upstream BOM decomposition for Notebooks / Stationery
    if any(w in combined_lower for w in ["notebook", "diary", "journal", "stationery", "exercise book"]):
        return [
            {
                "name": "70–80 GSM Maplitho Writing Paper",
                "type": "raw_material",
                "supplier_category": "RAW_MATERIAL_SUPPLIER",
                "purpose": f"Uncoated woodfree / maplitho inner writing paper reels & sheets for {product}",
                "search_terms": [
                    f"70 GSM maplitho paper manufacturers {city}",
                    f"70 GSM paper wholesalers {city}",
                    f"maplitho writing paper suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.97,
            },
            {
                "name": "300 GSM Duplex Board / Recycled Kraft Cover Cardstock",
                "type": "raw_material",
                "supplier_category": "RAW_MATERIAL_SUPPLIER",
                "purpose": f"Rigid front and back cover board / recycled kraft cardstock for {product}",
                "search_terms": [
                    f"300 GSM duplex board manufacturers {city}",
                    f"duplex board wholesalers {city}",
                    f"kraft cover paper board suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.96,
            },
            {
                "name": "Metal Spiral Binding Wire / Wiro Coil",
                "type": "component",
                "supplier_category": "COMPONENT_SUPPLIER",
                "purpose": f"Nylon-coated metal spiral wire / twin-loop binding coil for {product}",
                "search_terms": [
                    f"spiral binding wire manufacturers {city}",
                    f"metal spiral binding coil suppliers {city}",
                    f"wiro binding wire suppliers India",
                ],
                "location": loc,
                "confidence": 0.96,
            },
            {
                "name": "Commercial Offset Printing & Spiral Binding Service",
                "type": "process",
                "supplier_category": "CONTRACT_MANUFACTURER",
                "purpose": f"Sheet ruling, cover offset printing, perforation punching, and spiral binding",
                "search_terms": [
                    f"commercial notebook printing binding manufacturers {city}",
                    f"spiral notebook contract manufacturers {city}",
                ],
                "location": loc,
                "confidence": 0.94,
            },
            {
                "name": pack or "Shrink Film & 5-Ply Corrugated Packaging Cartons",
                "type": "packaging",
                "supplier_category": "PACKAGING_SUPPLIER",
                "purpose": f"Moisture-barrier shrink wrap and 5-ply corrugated master transit boxes",
                "search_terms": [
                    f"corrugated packaging box manufacturers {city}",
                    f"kraft paper packaging suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.93,
            },
        ]

    # Upstream BOM decomposition for Stainless Steel Bottles / Flasks
    if any(w in combined_lower for w in ["bottle", "flask", "tumbler", "thermos", "sipper"]):
        return [
            {
                "name": "SS 304 Food-Grade Stainless Steel Coils & Sheets",
                "type": "raw_material",
                "supplier_category": "RAW_MATERIAL_SUPPLIER",
                "purpose": f"Austenitic SS 304 food-grade cold-rolled steel coils/tubes for inner and outer shells",
                "search_terms": [
                    f"SS 304 stainless steel coil suppliers {city}",
                    f"304 stainless steel sheet wholesalers {city}",
                ],
                "location": loc,
                "confidence": 0.97,
            },
            {
                "name": "Food-Grade BPA-Free Silicone O-Ring Gasket",
                "type": "component",
                "supplier_category": "COMPONENT_SUPPLIER",
                "purpose": f"Leak-proof food-grade silicone sealing ring for lid closure",
                "search_terms": [
                    f"food grade silicone o ring manufacturers {city}",
                    f"silicone rubber gasket suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.95,
            },
            {
                "name": "PP / Bamboo Threaded Bottle Cap Closure",
                "type": "component",
                "supplier_category": "COMPONENT_SUPPLIER",
                "purpose": f"Insulated threaded screw cap component for {product}",
                "search_terms": [
                    f"plastic bottle cap closure manufacturers {city}",
                    f"injection molded cap suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.93,
            },
            {
                "name": "Vacuum Flask Hydroforming & Contract Manufacturing",
                "type": "process",
                "supplier_category": "CONTRACT_MANUFACTURER",
                "purpose": f"Double-wall deep drawing, vacuum brazing, electropolishing, and laser branding",
                "search_terms": [
                    f"stainless steel water bottle manufacturers {city}",
                    f"vacuum flask contract manufacturers India",
                ],
                "location": loc,
                "confidence": 0.94,
            },
            {
                "name": pack or "Recycled Kraft Tube & Corrugated Master Cartons",
                "type": "packaging",
                "supplier_category": "PACKAGING_SUPPLIER",
                "purpose": f"Cylindrical kraft retail canister and 5-ply corrugated shipping cartons",
                "search_terms": [
                    f"kraft paper tube packaging manufacturers {city}",
                    f"corrugated box suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.92,
            },
        ]

    # Upstream BOM decomposition for Cotton / Apparel / Tote Bags
    if any(w in combined_lower for w in ["tote", "cotton", "bag", "shirt", "apparel", "garment", "hoodie", "canvas"]):
        return [
            {
                "name": "GOTS Organic Cotton Canvas / Woven Greige Fabric",
                "type": "raw_material",
                "supplier_category": "RAW_MATERIAL_SUPPLIER",
                "purpose": f"Heavy-duty unbleached / dyed cotton canvas fabric rolls in GSM specification",
                "search_terms": [
                    f"cotton canvas fabric manufacturers {city}",
                    f"organic cotton fabric wholesalers {city}",
                ],
                "location": loc,
                "confidence": 0.96,
            },
            {
                "name": "Cotton Webbing Strap & High-Tenacity Stitching Thread",
                "type": "component",
                "supplier_category": "COMPONENT_SUPPLIER",
                "purpose": f"Reinforced cotton webbing handles, zippers, and industrial sewing thread",
                "search_terms": [
                    f"cotton webbing tape manufacturers {city}",
                    f"industrial sewing thread suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.94,
            },
            {
                "name": "Cut-and-Sew Bag / Garment Contract Manufacturing",
                "type": "process",
                "supplier_category": "CONTRACT_MANUFACTURER",
                "purpose": f"Pattern cutting, lockstitch assembly, bar-tacking, and water-based screen printing",
                "search_terms": [
                    f"cotton tote bag manufacturers {city}",
                    f"canvas bag contract manufacturers {city}",
                ],
                "location": loc,
                "confidence": 0.94,
            },
            {
                "name": pack or "Compostable Polybags & Corrugated Export Cartons",
                "type": "packaging",
                "supplier_category": "PACKAGING_SUPPLIER",
                "purpose": f"Individual biodegradable polybags, kraft hangtags, and corrugated master cartons",
                "search_terms": [
                    f"corrugated packaging box manufacturers {city}",
                    f"kraft hangtag packaging suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.91,
            },
        ]

    requirements: List[Dict[str, Any]] = []

    # Parse any explicit materials/components separated by commas or semicolons in `material`
    if mat:
        mat_parts = [m.strip() for m in re.split(r"[,;/+]", mat) if len(m.strip()) >= 2]
        for idx, mp in enumerate(mat_parts[:4]):
            req_type = "raw_material" if idx < 2 else "component"
            requirements.append(
                {
                    "name": mp,
                    "type": req_type,
                    "supplier_category": REQUIREMENT_TO_SUPPLIER_TYPE[req_type],
                    "purpose": f"Upstream {req_type.replace('_', ' ')} required to manufacture {product}",
                    "search_terms": _build_b2b_queries_for_requirement(mp, req_type, city),
                    "location": loc,
                    "confidence": 0.95,
                }
            )
    else:
        requirements.append(
            {
                "name": f"{product} Primary Raw Material & Industrial Grade Feedstock",
                "type": "raw_material",
                "supplier_category": "RAW_MATERIAL_SUPPLIER",
                "purpose": f"Primary upstream raw material required to manufacture {product}",
                "search_terms": [
                    f"{product} raw material suppliers {city}",
                    f"{product} material wholesalers {city}",
                ],
                "location": loc,
                "confidence": 0.92,
            }
        )
        requirements.append(
            {
                "name": f"{product} Hardware & Sub-Assembly Components",
                "type": "component",
                "supplier_category": "COMPONENT_SUPPLIER",
                "purpose": f"Functional hardware and sub-components for {product}",
                "search_terms": [
                    f"{product} components manufacturers {city}",
                    f"{product} parts suppliers {city}",
                ],
                "location": loc,
                "confidence": 0.91,
            }
        )

    requirements.append(
        {
            "name": f"{product} Contract Manufacturing & Industrial Assembly",
            "type": "process",
            "supplier_category": "CONTRACT_MANUFACTURER",
            "purpose": f"B2B OEM/contract manufacturing, tooling, and assembly for {product}",
            "search_terms": [
                f"{product} manufacturers {city}",
                f"{product} OEM manufacturer {city}",
            ],
            "location": loc,
            "confidence": 0.93,
        }
    )

    pack_label = pack if pack else f"Corrugated Master Cartons & Kraft Packaging"
    requirements.append(
        {
            "name": pack_label,
            "type": "packaging",
            "supplier_category": "PACKAGING_SUPPLIER",
            "purpose": f"Protective unit and bulk transit B2B packaging for {product}",
            "search_terms": [
                f"{pack if pack else 'corrugated packaging box'} manufacturers {city}",
                f"kraft packaging suppliers {city}",
            ],
            "location": loc,
            "confidence": 0.91,
        }
    )

    return requirements


def analyze_product_requirements(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes a user product description or mission specification via Gemini AI and decomposes it into
    upstream manufacturing sourcing requirements (raw_material, component, packaging, process) with
    dynamic B2B search queries for live internet supplier discovery.
    """
    prompt_text = str(
        payload.get("prompt")
        or payload.get("product_name")
        or payload.get("product")
        or payload.get("product_description")
        or ""
    ).strip()
    constraints = _parse_natural_language_constraints(prompt_text, payload)
    loc = constraints["preferred_sourcing_location"]
    city = loc.split(",")[0].strip()

    ai_prompt = (
        "You are helping a founder MANUFACTURE a physical product in India.\n"
        "Decompose the product into its UPSTREAM MANUFACTURING INPUTS (raw materials, components, packaging, and manufacturing processes).\n"
        "CRITICAL RULES:\n"
        "1. Do NOT generate retail search queries or finished-product shop queries (NEVER output 'buy online', 'shops', 'stores', 'sellers').\n"
        "2. Prioritize RAW MATERIAL SUPPLIERS, COMPONENT SUPPLIERS, WHOLESALERS, PACKAGING SUPPLIERS, and CONTRACT MANUFACTURERS.\n"
        "3. Generate 4 to 6 specific upstream requirements. Put raw_material and component requirements FIRST, followed by process/contract manufacturing and packaging.\n\n"
        f"Product to Manufacture: {constraints['product_name']}\n"
        f"Description / Prompt: {constraints['product_description']}\n"
        f"Specified Material: {constraints['material'] or 'Infer upstream raw materials & components from product'}\n"
        f"Production Quantity: {constraints['quantity']} units\n"
        f"Target Unit Cost: ₹{constraints['target_unit_cost']}/unit\n"
        f"Delivery Deadline: {constraints['delivery_deadline']} days\n"
        f"Packaging: {constraints['packaging_requirements'] or 'Recycled kraft / corrugated master cartons'}\n"
        f"Certifications: {constraints['certification_requirements'] or 'Standard B2B quality'}\n"
        f"Preferred Location: {loc}\n\n"
        "Return JSON with exact keys:\n"
        "{\n"
        '  "product": "<clear product name>",\n'
        '  "inferred_material_summary": "<comma-separated summary of upstream raw materials and components>",\n'
        '  "requirements": [\n'
        "    {\n"
        '      "name": "<specific upstream raw material, component, packaging, or manufacturing process>",\n'
        '      "type": "raw_material | component | packaging | process",\n'
        '      "supplier_category": "RAW_MATERIAL_SUPPLIER | COMPONENT_SUPPLIER | PACKAGING_SUPPLIER | CONTRACT_MANUFACTURER | MANUFACTURER | WHOLESALER",\n'
        '      "purpose": "<how this input is used to manufacture the product>",\n'
        f'      "search_terms": ["<specific raw material/component> manufacturers {city}", "<specific raw material/component> wholesalers {city}"],\n'
        f'      "location": "{loc}",\n'
        '      "confidence": 0.95\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    ai_res = call_gemini_json(
        prompt=ai_prompt,
        system_instruction=(
            "You are Vendra's Upstream Manufacturing BOM & Raw-Material Decomposition Engine. "
            "Always decompose products into upstream raw materials, components, packaging, and B2B manufacturing processes. "
            "For example, for Spiral Binded Notebooks, decompose into: 70-80 GSM Maplitho Paper (raw_material), "
            "300 GSM Duplex Cover Board (raw_material), Metal Spiral Binding Wire (component), "
            "Commercial Offset Printing & Binding (process), and Corrugated Packaging Cartons (packaging)."
        ),
        timeout_sec=9.0,
    )

    requirements: List[Dict[str, Any]] = []
    if isinstance(ai_res, dict) and isinstance(ai_res.get("requirements"), list):
        for raw_item in ai_res["requirements"]:
            if isinstance(raw_item, dict) and raw_item.get("name"):
                requirements.append(_normalize_requirement_item(raw_item, loc))
        if ai_res.get("inferred_material_summary") and not constraints["material"]:
            constraints["material"] = str(ai_res["inferred_material_summary"]).strip()
        if ai_res.get("product") and not payload.get("product_name"):
            constraints["product_name"] = str(ai_res["product"]).strip()

    if not requirements:
        requirements = _fallback_dynamic_decomposition(constraints)
        if not constraints["material"]:
            raw_mats = [
                r["name"] for r in requirements if r["type"] in ("raw_material", "component")
            ]
            constraints["material"] = ", ".join(raw_mats[:3])

    # Sort so raw_material and component requirements always lead
    type_priority = {"raw_material": 0, "component": 1, "packaging": 2, "process": 3}
    requirements.sort(key=lambda r: type_priority.get(str(r.get("type") or ""), 4))

    return {
        "product": constraints["product_name"],
        "extracted_constraints": constraints,
        "requirements": requirements,
    }
