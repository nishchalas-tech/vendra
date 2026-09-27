-- Vendra Relational Schema Migration (001_initial_schema.sql)
-- Enforces foreign keys, user ownership, and auditability across all procurement tables.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT 'Bengaluru',
    state TEXT DEFAULT 'Karnataka',
    is_demo_user INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS founder_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    company_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT 'Bengaluru',
    state TEXT DEFAULT 'Karnataka',
    business_experience TEXT DEFAULT '',
    skills TEXT DEFAULT '',
    industry_interests TEXT DEFAULT '',
    available_capital REAL DEFAULT 0,
    preferred_product_categories TEXT DEFAULT '',
    available_time TEXT DEFAULT '',
    preferred_sourcing_location TEXT DEFAULT 'Bengaluru, Karnataka',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_description TEXT DEFAULT '',
    product_category TEXT DEFAULT 'Consumer Goods',
    quantity INTEGER NOT NULL,
    target_unit_cost REAL NOT NULL,
    maximum_budget REAL NOT NULL,
    material TEXT DEFAULT '',
    quality_requirements TEXT DEFAULT '',
    packaging_requirements TEXT DEFAULT '',
    certification_requirements TEXT DEFAULT '',
    preferred_sourcing_location TEXT DEFAULT 'Bengaluru, Karnataka',
    delivery_deadline INTEGER NOT NULL,
    additional_requirements TEXT DEFAULT '',
    state TEXT NOT NULL DEFAULT 'DRAFT',
    selected_supplier_id TEXT DEFAULT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    workflow_state_json TEXT DEFAULT '{}',
    requirements_json TEXT DEFAULT '[]',
    search_queries_json TEXT DEFAULT '[]',
    discovery_mode TEXT DEFAULT 'LIVE_WEB_SEARCH',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    area TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    manufacturing_capabilities TEXT NOT NULL,
    materials TEXT NOT NULL,
    minimum_order_quantity INTEGER NOT NULL,
    indicative_unit_price_inr REAL NOT NULL,
    lead_time_days INTEGER NOT NULL,
    certifications TEXT NOT NULL,
    packaging_capabilities TEXT NOT NULL,
    payment_terms TEXT NOT NULL,
    shipping_regions TEXT NOT NULL,
    reliability_score REAL NOT NULL,
    evidence TEXT NOT NULL,
    demo_supplier INTEGER NOT NULL DEFAULT 1,
    website TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    source_title TEXT DEFAULT '',
    source_snippet TEXT DEFAULT '',
    discovery_source TEXT DEFAULT 'LIVE_WEB_SEARCH',
    verification_status TEXT DEFAULT 'PARTIAL_WEB_DATA_NEEDS_RFQ',
    search_query_used TEXT DEFAULT '',
    matched_requirement TEXT DEFAULT '',
    contact_info TEXT DEFAULT '',
    confidence_score REAL DEFAULT 0.85,
    moq_verified INTEGER DEFAULT 0,
    price_verified INTEGER DEFAULT 0,
    lead_time_verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_suppliers (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    match_factors_json TEXT NOT NULL DEFAULT '{}',
    eligibility_status TEXT NOT NULL DEFAULT 'Eligible',
    risk_level TEXT NOT NULL DEFAULT 'Low',
    is_selected INTEGER NOT NULL DEFAULT 0,
    is_recovery_alternative INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(mission_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS rfqs (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    product_requirements TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    material TEXT NOT NULL,
    quality TEXT NOT NULL,
    packaging TEXT NOT NULL,
    certification TEXT NOT NULL,
    delivery_deadline INTEGER NOT NULL,
    pricing_request TEXT NOT NULL,
    moq_request INTEGER NOT NULL,
    lead_time_request INTEGER NOT NULL,
    payment_terms TEXT NOT NULL,
    shipping_requirements TEXT NOT NULL,
    rfq_body TEXT NOT NULL,
    sent_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_responses (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    rfq_id TEXT DEFAULT NULL REFERENCES rfqs(id) ON DELETE SET NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    raw_message TEXT DEFAULT '',
    unit_price REAL DEFAULT NULL,
    moq INTEGER DEFAULT NULL,
    lead_time_days INTEGER DEFAULT NULL,
    material TEXT DEFAULT NULL,
    certifications TEXT DEFAULT NULL,
    packaging TEXT DEFAULT NULL,
    payment_terms TEXT DEFAULT NULL,
    shipping_cost_inr REAL DEFAULT NULL,
    packaging_cost_inr REAL DEFAULT NULL,
    other_costs_inr REAL DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    evidence TEXT NOT NULL DEFAULT 'Illustrative demo data',
    cost_breakdown_json TEXT NOT NULL DEFAULT '{}',
    constraint_results_json TEXT NOT NULL DEFAULT '[]',
    is_valid_all_constraints INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risks (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT DEFAULT NULL,
    supplier_name TEXT DEFAULT '',
    risk_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    what_changed TEXT NOT NULL,
    why_problem TEXT NOT NULL,
    constraint_failed TEXT NOT NULL,
    expected_value TEXT NOT NULL,
    actual_value TEXT NOT NULL,
    vendra_action TEXT NOT NULL,
    recovery_options_json TEXT NOT NULL DEFAULT '[]',
    requires_human_approval INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    supplier_id TEXT DEFAULT NULL,
    supplier_name TEXT DEFAULT '',
    location TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    lead_time_days INTEGER DEFAULT 0,
    certification TEXT DEFAULT '',
    risk_summary TEXT DEFAULT '',
    evidence TEXT DEFAULT 'Illustrative demo data',
    recommendation_rationale TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING',
    requested_at TEXT NOT NULL,
    approved_at TEXT DEFAULT NULL,
    rejected_at TEXT DEFAULT NULL,
    decision_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    mission_id TEXT DEFAULT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    input_reference TEXT DEFAULT '',
    output_reference TEXT DEFAULT '',
    policy_decision TEXT NOT NULL,
    result TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_hash TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL
);
