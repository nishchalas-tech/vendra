# Vendra — AI Supply Chain & Live Internet Sourcing Execution Operating System (India)

**Vendra** is a full-stack, production-grade **AI Supply Chain & Sourcing Execution Operating System** built for founders, D2C brands, hardware startups, and MSME procurement operators in India.

Unlike static B2B directories or generic conversational chatbots that hallucinate supplier prices, Vendra executes a grounded, policy-governed end-to-end procurement pipeline in **Indian Rupees (`₹`)**:

```text
USER PRODUCT SPECIFICATION
  │
  ▼
1. AI PRODUCT UNDERSTANDING & MATERIAL / COMPONENT DECOMPOSITION (BOM)
  │  (Decomposes any product into raw_material, component, packaging, and process requirements)
  ▼
2. DYNAMIC SEARCH QUERY GENERATION
  │  (Constructs targeted Indian B2B search queries per material, component, and manufacturing cluster)
  ▼
3. REAL-TIME LIVE INTERNET SUPPLIER DISCOVERY
  │  (Queries live Indian B2B web directories + Gemini Google Search grounding in parallel)
  ▼
4. ZERO-HALLUCINATION EVIDENCE EXTRACTION & SOURCE PROVENANCE
  │  (Extracts real company names, URLs, domains, locations, and public specs; never invents missing MOQ/price)
  ▼
5. MULTI-FACTOR CONSTRAINT EVALUATION & SUPPLIER RANKING
  │  (Scores relevance, location match, MOQ, target unit cost, total budget, lead time, and verification signals)
  ▼
6. COMMERCIAL RFQ GENERATION & DISPATCH
  │  (Generates structured Request for Quotation documents to verify unstated pricing, MOQ, and lead times)
  ▼
7. SUPPLIER QUOTE PARSING & DETERMINISTIC LANDED INR (₹) COST ENGINE
  │  (Parses raw WhatsApp/email quotes and computes base manufacturing + packaging + shipping + landed unit cost)
  ▼
8. SUPPLY CHAIN RISK DETECTION & AUTONOMOUS FAILURE RECOVERY
  │  (Detects delivery delays or budget breaches and autonomously discovers compliant backup suppliers)
  ▼
9. DETERMINISTIC POLICY ENGINE & HUMAN-IN-THE-LOOP APPROVAL GATE
  │  (Blocks autonomous financial commitments; requires explicit human approval before awarding any contract)
  ▼
10. IMMUTABLE AUDIT LEDGER
     (Records every AI decision, web search query, policy check, RFQ, and human approval with full traceability)
```

---

## 1. Real-World Problem & Market Gap Analysis

### Why Traditional Manufacturing Procurement in India Is Broken

When an Indian founder, D2C operator, or MSME buyer wants to manufacture a physical product (for example, *1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit within 30 days* or *1,000 Insulated SS 304 Water Bottles*), they face six major operational bottlenecks:

1. **The Bill-of-Materials (BOM) Knowledge Gap**:
   - First-time founders and lean procurement teams often know the *finished product* they want to sell, but do not know the exact industrial raw materials, sub-components, GSM/alloy grades, or manufacturing processes required (e.g., *70 GSM Maplitho writing paper*, *300 GSM Duplex cover board*, *nylon-coated wiro spiral binding wire*, *BIS IS 14756 food-grade SS 304 coils*).
2. **Noisy, Unfiltered B2B Directories**:
   - Searching Indian B2B portals manually returns hundreds of unorganized listings mixed with irrelevant categories, traders masquerading as manufacturers, or out-of-state suppliers that do not match the buyer's keyword or cluster.
3. **Incomplete Public Pricing & AI Hallucinations**:
   - Real B2B supplier web listings rarely publish all commercial terms publicly—many omit MOQ, exact unit pricing, or delivery lead times until an RFQ is submitted. Standard LLM chatbots hallucinate fake prices, fake phone numbers, and fake ISO certifications to appear helpful, leading to disastrous procurement assumptions.
4. **Hidden Landed Cost Surprises (INR `₹`)**:
   - Buyers evaluate ex-works unit quotes without factoring in secondary packaging, local freight, and tooling/other charges, causing total procurement spend to exceed the hard capital budget.
5. **Single-Point Supplier Delays & Schedule Disruptions**:
   - When a primary manufacturer delays delivery (e.g., lead time slips from 25 days to 42 days against a 30-day launch deadline), teams scramble manually for weeks to find, qualify, and price-check a replacement vendor.
6. **Lack of Financial Governance & Auditability**:
   - Quotes arrive over unstructured WhatsApp messages and emails with no centralized constraint checking, no formal human-in-the-loop approval gate, and no audit trail explaining *why* a vendor was selected.

### How Vendra Bridges the Real-World Gap

| Dimension | Traditional B2B Directories | Generic AI Chatbots | **Vendra Sourcing OS** |
| :--- | :--- | :--- | :--- |
| **Product → BOM Decomposition** | None (User must know exact raw material terms) | Unstructured text advice | **Structured, editable BOM** (`raw_material`, `component`, `packaging`, `process`) with confidence scores & search terms |
| **Supplier Discovery** | Manual keyword search across fragmented pages | Hallucinates company names or uses static training data | **Real-time parallel live internet search** with strict product/material keyword relevance filtering |
| **Missing Commercial Data (MOQ / Price / Lead Time)** | Hidden behind lead-capture forms | Invents fake numbers | **Strict Zero-Hallucination Policy**: explicitly displays `Quote required`, `Not publicly listed`, or `Not verified` |
| **Source Provenance** | Manual bookmarking | No verifiable links | **Mandatory Source URL, Domain, Title, Search Query Used & Evidence Snippet** per supplier |
| **Cost Calculation** | Manual spreadsheets | Prone to arithmetic errors | **Deterministic INR (`₹`) Landed Cost Engine** (Base + Packaging + Shipping = Landed Unit & Total Spend vs. Budget) |
| **Supplier Delay Recovery** | Manual panic re-sourcing | Cannot execute workflow state transitions | **Autonomous Failure Recovery Workflow** that re-scans alternatives and prepares a side-by-side recovery recommendation |
| **Financial Control** | Ad-hoc verbal/email sign-offs | Unsafe autonomous actions | **Deterministic Policy Engine + Mandatory Human Approval Gate** (`PENDING` → `APPROVED` / `REJECTED`) |

---

## 2. Core Features & Real-World Use Cases

### Feature 1: AI Product Understanding & Material / Component Decomposition
- **What It Does**: Takes a natural language manufacturing goal (e.g., *"I want to manufacture 1,000 Spiral Binded Notebooks in Bengaluru under ₹250 per unit within 30 days"*) and decomposes it into structured sourcing requirements:
  - `raw_material` (e.g., *70 GSM / 80 GSM Maplitho Writing Paper*, *300 GSM Duplex Cover Board*)
  - `component` (e.g., *Nylon-Coated Metal Spiral Binding Wire*)
  - `process` (e.g., *Spiral Notebook Offset Printing, Punching & Binding*)
  - `packaging` (e.g., *Shrink Wrap Film & 5-Ply Corrugated Master Cartons*)
- **Interactive Review & Editing**: Users can add, edit, or delete decomposed requirements and customize the exact live internet search queries before or after creating a mission.
- **Real-World Use**: Enables D2C founders and category managers to source both finished OEM assemblies and individual Tier-2 raw materials without needing prior industrial engineering expertise.

### Feature 2: Upstream Raw-Material & Component Live Supplier Discovery (`supplier_discovery_service.py`)
- **What It Does**: Dynamically generates upstream B2B search queries from the product's decomposed BOM requirements (`raw_material`, `component`, `packaging`, `process`) and executes real-time parallel web searches across live Indian B2B directories (**IndiaMART**, **TradeIndia**) and **Google GenAI Search Grounding** (`from google import genai`, `from google.genai import types`).
- **Supplier Type Classification**: Classifies every discovered supplier into an explicit upstream procurement category:
  - `RAW_MATERIAL_SUPPLIER` (e.g., 70–80 GSM Maplitho paper mills/suppliers, 300 GSM Duplex board manufacturers, SS 304 steel coil suppliers)
  - `COMPONENT_SUPPLIER` (e.g., metal spiral binding wire / wiro coil manufacturers, food-grade silicone O-ring gasket suppliers)
  - `MANUFACTURER` / `WHOLESALER` / `CONTRACT_MANUFACTURER` / `PACKAGING_SUPPLIER` / `SERVICE_PROVIDER`
  - Automatically excludes consumer retailers (`RETAILER`) and de-prioritizes generic finished-product resellers (`FINISHED_PRODUCT_RESELLER`).
- **5-Tab Supplier & RFQ Hub (`/suppliers`)**:
  - **TAB 1 — DISCOVER**: Mission summary strip, interactive Material / Component Requirement cards with per-requirement `[Find Suppliers]` triggers, and overflow-proof supplier results.
  - **TAB 2 — COMPARE**: Clean side-by-side comparison of shortlisted suppliers (`Supplier`, `Type`, `Requirement`, `Location`, `MOQ`, `Price`, `Lead Time`, `Certification`, `Match`, `Verification`) with `[Select]`, `[View Source]`, and `[Generate RFQ]`.
  - **TAB 3 — RFQs**: Commercial RFQ management (`RFQ-001`, Supplier, Requirement, Quantity, Status, Created) with `[View]`, `[Edit]`, `[Send]`, and `[View Response]` opening a full RFQ side panel.
  - **TAB 4 — RESPONSES**: Supplier quotation responses (`Quoted Price`, `MOQ`, `Lead Time`, `Payment Terms`, `Not provided` handling) with `[View Full Response]`, `[Compare]`, and `[Use for Mission]`.
  - **TAB 5 — SOURCING ACTIVITY**: Real-time audit log of live search executions showing timestamp, target requirement, generated queries, web sources discovered, and verified suppliers extracted.

### Feature 3: Zero-Hallucination Evidence Extraction & Provenance Ledger
- **What It Does**: Extracts only factual fields supported by the live web source:
  - If MOQ is not stated on the page → displays **`Not publicly listed`** (`Verify via RFQ`).
  - If unit price is not stated → displays **`Quote required`**.
  - If lead time is not stated → displays **`Not publicly listed`**.
  - If certifications are not stated → displays **`Not verified`**.
- **Full Traceability**: Every supplier row displays a `LIVE_WEB_SEARCH` badge, source domain (`indiamart.com`, `tradeindia.com`, or company domain), clickable external source link, matched BOM requirement badge, and exact search query executed.

### Feature 4: Commercial RFQ Generation & Dispatch (`rfq_service.py`)
- **What It Does**: Generates structured commercial Request for Quotation (RFQ) documents tailored to the mission's quantity, material specs, target unit price (`₹`), packaging requirements, and delivery deadline, specifically requesting confirmation of any unverified web fields.
- **Real-World Use**: Standardizes vendor outreach so every supplier quotes on an identical, comparable specification.

### Feature 5: Unstructured Quote Parser & Deterministic Landed INR (`₹`) Cost Engine
- **What It Does**: Parses raw supplier replies (from email or WhatsApp text) or structured quote inputs, then runs `cost_calculator.py` and `constraint_checker.py` to compute:
  - Base Manufacturing Cost (`unit_price × quantity`)
  - Packaging Cost (`₹`)
  - Shipping / Logistics Cost (`₹`)
  - Other / Tooling Charges (`₹`)
  - **Landed Unit Cost (`₹/unit`)** and **Total Procurement Cost (`₹`)**
  - **Budget Variance (`₹`)** against the mission's hard budget cap.

### Feature 6: Supply Chain Risk Detection & Autonomous Failure Recovery
- **What It Does**: Monitors active supplier quotes and webhook events against mission constraints. If a selected or quoting supplier reports a delivery delay (e.g., 42 days vs. a 30-day deadline), Vendra automatically:
  1. Raises a structured `RiskAlert` (`HIGH` severity) detailing what changed and which constraint failed.
  2. Transitions the mission into `RECOVERY` state.
  3. Searches and ranks alternative compliant suppliers that can meet the original deadline and budget.
  4. Submits the top recovery supplier to the **Human Approval Gate**.

### Feature 7: Deterministic Policy Engine & Human-in-the-Loop Approval Gate
- **What It Does**: Evaluates every agent action against hard deterministic rules (`policy/engine.py`):
  - Read-only analysis, live web discovery, and RFQ drafting are marked `AUTO_EXECUTE`.
  - Final supplier selection, contract award, budget commitment, or supplier recovery switching **always** returns `REQUIRE_APPROVAL`.
- **Real-World Use**: Guarantees that AI never commits company funds or switches factory orders without explicit founder/manager sign-off (`Approve` / `Reject` with audit notes).

### Feature 8: Vendra AI Sourcing Chatbot (`VendraChatbot.tsx` & `chat_service.py`)
- **What It Does**: Available both as a global slide-over drawer on every screen and embedded directly inside each Mission Workspace. Connected to the **exact same backend services** (`supplier_discovery_service`, `product_decomposition`, `mission_service`, `rfq_service`, `approval_service`, `risk_service`).
- **Capabilities**:
  - *"Find live suppliers for 1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit"* → Decomposes BOM, runs live web search, and renders interactive supplier cards with clickable source links.
  - *"Decompose 1,000 insulated stainless steel water bottles into materials & components"* → Runs BOM decomposition and displays requirement tags.
  - *"Create a mission for 1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit within 30 days"* → Creates and launches the mission end-to-end and provides a one-click button to open the workspace.
  - *"Generate & send RFQs to top discovered suppliers"* or *"Simulate a 42-day supplier delay and run recovery"* → Executes the workflow directly on the active mission.

### Feature 9: Voice Command Interface (`VoicePanel.tsx` & `elevenlabs.py`)
- **What It Does**: Interprets spoken or typed operational transcripts (e.g., *"Supplier B cannot deliver before next month. Find another supplier in Bengaluru under three lakh"*), converts them into structured orchestrator commands, executes the backend recovery workflow, and synthesizes spoken audio feedback when `ELEVENLABS_API_KEY` is configured.

### Feature 10: Isolated Demo Mode vs. Clean Normal Mode
- **Normal Mode**: Every newly registered founder starts with `0` fake missions. All product decompositions and supplier discoveries run live against the internet.
- **Explicit Demo Mode**: Clicking **"Try Demo Scenario"** loads an isolated sandbox account (`demo.founder@vendra.in`) with a deterministic 12-supplier catalog so evaluators can test the scripted Supplier B delay (`25 days → 42 days`) and recovery workflow without touching real user data.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | **React 19 + TypeScript + Vite 6** | Single-Page Application with responsive industrial workspace layout, dark/light theme support, and interactive modals |
| **Styling & Icons** | **Tailwind CSS v4 + Lucide React** | High-contrast tabular financial UI, status badges, and provenance indicators |
| **Routing** | **React Router v7** | Client-side navigation across 15 operational views |
| **API Gateway** | **Express.js (`server.ts` on Port `3000`)** | Serves the Vite frontend and proxies `/api/*` and `/health` requests to the Python backend |
| **Backend Core** | **Python 3.10 (`ThreadingHTTPServer` on Port `8001`)** | Modular REST API server, multi-agent orchestrator, deterministic policy engine, and durable workflow state machine |
| **AI & Web Grounding** | **Google GenAI Python SDK (`google.genai`) + Gemini API (`GEMINI_API_KEY`)** | Product-to-BOM material decomposition, RFQ drafting, chatbot reasoning, and parallel live Indian B2B internet search (**IndiaMART** + **TradeIndia** + **Google Search Grounding**) |
| **Database** | **SQLite 3 (WAL Mode + Foreign Keys)** | Relational persistence across 10 normalized tables (`users`, `sessions`, `founder_profiles`, `missions`, `suppliers`, `mission_suppliers`, `rfqs`, `supplier_responses`, `risk_events`, `approvals`, `audit_events`, `chat_messages`) |
| **External Integrations** | **ElevenLabs, News API, n8n Webhooks, Render Workflows** | Voice synthesis, market signal intelligence, external webhook automation, and workflow step mapping |

---

## 4. Complete Folder & File Structure (Every File Explained)

```text
vendra/
├── README.md                                     # Complete project documentation, architecture, file guide & setup instructions
├── .env.example                                  # Template of all backend/integration environment variables (zero secrets)
├── package.json                                  # Node.js dependencies and scripts (`npm run dev`, `npm run build`, `npm start`)
├── tsconfig.json                                 # TypeScript compiler configuration
├── vite.config.ts                                # Vite bundler configuration with React & Tailwind CSS v4 plugins
├── index.html                                    # HTML entry point with SEO & OpenGraph metadata
├── metadata.json                                 # AI Studio applet capability and metadata manifest
├── server.ts                                     # Express + Vite gateway on port 3000; manages & proxies to Python backend on port 8001
├── requirements.txt                              # Python package dependencies
├── pyproject.toml                                # Python project metadata & test runner configuration
├── Dockerfile                                    # Container build definition for production deployment
├── docker-compose.yml                            # Multi-service container orchestration
├── render.yaml                                   # Render.com cloud deployment blueprint
├── firebase-blueprint.json                       # Firestore schema blueprint reference
├── firestore.rules                               # Security rules reference
│
├── google/                                       # Google GenAI Python SDK & Live Internet B2B Grounding Package
│   ├── __init__.py                               # Google namespace package initializer
│   └── genai/
│       ├── __init__.py                           # Implements `genai.Client`, `models.generate_content`, and parallel IndiaMART + TradeIndia live internet supplier search with strict keyword relevance scoring
│       └── types.py                              # Implements `types.Tool`, `types.GoogleSearch`, `types.GenerateContentConfig`, `types.GroundingMetadata`, and response data structures
│
├── backend/                                      # Python Backend Application & Test Suite
│   ├── app/
│   │   ├── __init__.py                           # Backend app package initializer
│   │   ├── main.py                               # HTTP server entry point (`port 8001`), URL router, CORS handler, and authentication middleware
│   │   │
│   │   ├── core/                                 # Core Configuration, Logging & Security
│   │   │   ├── config.py                         # Reads environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`, `SQLITE_PATH`, etc.)
│   │   │   ├── logging.py                        # Structured application logger
│   │   │   └── security.py                       # PBKDF2-HMAC-SHA256 password hashing and cryptographic session token generation
│   │   │
│   │   ├── database/                             # Relational SQLite Database Engine, Migrations & Seed
│   │   │   ├── base.py                           # ID generator (`new_id`) and UTC ISO-8601 timestamp helper (`utc_now_iso`)
│   │   │   ├── session.py                        # Thread-safe SQLite connection manager (`get_db`), WAL pragma setup, and automatic schema migrations (`run_migrations`)
│   │   │   ├── seed.py                           # Seeds the 12 illustrative suppliers (`demo_supplier = 1`) used exclusively in explicit Demo Mode
│   │   │   └── migrations/
│   │   │       └── 001_initial_schema.sql        # Complete relational DDL schema for users, missions, suppliers, RFQs, responses, risks, approvals, and audit logs
│   │   │
│   │   ├── models/                               # Domain Entity Models & State Enums
│   │   │   ├── user.py                           # User and FounderProfile domain structures
│   │   │   ├── mission.py                        # `MissionState` enum (`DRAFT`, `READY`, `SUPPLIER_DISCOVERY`, `RFQ_PREPARATION`, `WAITING_FOR_RESPONSE`, `EVALUATING`, `RISK_DETECTED`, `RECOVERY`, `APPROVAL_PENDING`, `APPROVED`, `EXECUTING`, `COMPLETED`, `REJECTED`, `CANCELLED`)
│   │   │   ├── supplier.py                       # Supplier entity attributes and verification flags
│   │   │   ├── rfq.py                            # Request for Quotation domain structure
│   │   │   ├── risk.py                           # Supply chain risk alert and recovery option models
│   │   │   ├── approval.py                       # Human-in-the-loop approval request model
│   │   │   └── audit.py                          # Immutable audit trail event model
│   │   │
│   │   ├── schemas/                              # Validation & Agent Decision Schemas
│   │   │   ├── agent_decision.py                 # Validates structured `AgentDecision` outputs from the Mission Orchestrator
│   │   │   ├── auth.py                           # Signup/login request validation helpers
│   │   │   ├── mission.py                        # Mission creation and update payload schemas
│   │   │   ├── supplier.py                       # Supplier response and provenance schemas
│   │   │   ├── rfq.py                            # RFQ generation payload schema
│   │   │   └── approval.py                       # Approval decision (`APPROVED` / `REJECTED`) schema
│   │   │
│   │   ├── prompts/                              # System Prompts for AI Agents
│   │   │   ├── mission_orchestrator.txt          # System instructions for the central Mission Orchestrator
│   │   │   ├── supplier_agent.txt                # System instructions for supplier evaluation & RFQ drafting
│   │   │   ├── risk_recovery_agent.txt           # System instructions for schedule/budget breach recovery
│   │   │   ├── opportunity_agent.txt             # System instructions for market signal analysis
│   │   │   └── voice_agent.txt                   # System instructions for voice transcript intent extraction
│   │   │
│   │   ├── agents/                               # Specialized AI Agents
│   │   │   ├── orchestrator.py                   # Central `MissionOrchestrator` coordinating tool selection and policy validation
│   │   │   ├── supplier_agent.py                 # Agent wrapper for supplier discovery and RFQ preparation
│   │   │   ├── risk_recovery_agent.py            # Agent wrapper for failure detection and backup supplier ranking
│   │   │   ├── opportunity_agent.py              # Agent separating News Facts, Market Inferences, and Product Hypotheses
│   │   │   └── voice_agent.py                    # Agent interpreting spoken founder commands
│   │   │
│   │   ├── tools/                                # 9 Deterministic & AI-Grounded Procurement Tools
│   │   │   ├── product_decomposition.py          # Decomposes any product/prompt into structured BOM requirements (`raw_material`, `component`, `packaging`, `process`) and search queries
│   │   │   ├── supplier_search.py                # Mission supplier discovery tool delegating to `supplier_discovery_service.py`
│   │   │   ├── supplier_lookup.py                # Looks up individual supplier records by `supplier_id`
│   │   │   ├── rfq_generator.py                  # Drafts commercial RFQ documents in INR (`₹`)
│   │   │   ├── response_parser.py                # Extracts unit price, MOQ, lead time, and terms from raw supplier messages without fabricating missing fields
│   │   │   ├── cost_calculator.py                # Deterministic INR (`₹`) landed cost engine (`calculate_procurement_cost`, `format_inr`)
│   │   │   ├── constraint_checker.py             # Checks quotes against MOQ, unit cost target, max budget, deadline, and location constraints
│   │   │   ├── risk_detector.py                  # Detects schedule delays and cost overruns from supplier updates
│   │   │   └── approval_gate.py                  # Enforces human approval gate creation before contract award
│   │   │
│   │   ├── policy/                               # Deterministic Governance & Policy Engine
│   │   │   ├── engine.py                         # Evaluates agent decisions and returns `AUTO_EXECUTE`, `REQUIRE_APPROVAL`, or `BLOCK`
│   │   │   └── rules.py                          # Explicit policy rules governing financial commitments and constraint violations
│   │   │
│   │   ├── services/                             # Core Business Logic Services
│   │   │   ├── supplier_discovery_service.py     # Unified Live Internet Supplier Discovery Service used by both Main UI and Chatbot
│   │   │   ├── supplier_service.py               # Persists, hydrates, and queries discovered live web suppliers and mission shortlists
│   │   │   ├── mission_service.py                # End-to-end mission lifecycle management, BOM updates, and workspace hydration
│   │   │   ├── chat_service.py                   # Vendra AI Chatbot backend service connected to live discovery, decomposition, missions, and RFQs
│   │   │   ├── rfq_service.py                    # Creates, lists, and dispatches RFQs
│   │   │   ├── approval_service.py               # Manages pending human approvals and executes post-approval state transitions
│   │   │   ├── risk_service.py                   # Persists and queries supply chain risk alerts and recovery options
│   │   │   ├── finance_service.py                # Records and queries immutable audit trail events
│   │   │   ├── auth_service.py                   # User registration, login authentication, and session token lookup
│   │   │   └── user_service.py                   # Founder onboarding and profile management
│   │   │
│   │   ├── workflows/                            # Multi-Step Procurement Workflows
│   │   │   ├── mission_workflow.py               # Executes mission launch (`READY -> SUPPLIER_DISCOVERY -> RFQ_PREPARATION -> WAITING_FOR_RESPONSE`) and quote evaluation
│   │   │   ├── supplier_recovery.py              # Executes autonomous supplier failure recovery (`RISK_DETECTED -> RECOVERY -> APPROVAL_PENDING`)
│   │   │   └── opportunity_to_mission.py         # Converts an Opportunity Radar hypothesis into a structured Sourcing Mission
│   │   │
│   │   ├── integrations/                         # External Service Integrations
│   │   │   ├── gemini.py                         # Google GenAI SDK integration (`call_gemini_text`, `call_gemini_json`, `call_gemini_grounded_search`)
│   │   │   ├── elevenlabs.py                     # Voice command interpretation and ElevenLabs TTS synthesis
│   │   │   ├── news_api.py                       # Live NewsAPI integration for Opportunity Radar
│   │   │   ├── n8n.py                            # Outbound/inbound n8n workflow webhook integration
│   │   │   ├── render.py                         # Maps mission states to durable Render workflow execution steps
│   │   │   ├── dodo.py                           # Procurement settlement status integration
│   │   │   └── breeth.py                         # Carbon/sustainability compliance status integration
│   │   │
│   │   └── api/                                  # HTTP Route Handlers
│   │       ├── auth.py                           # `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
│   │       ├── profile.py                        # `GET /api/profile`, `PUT /api/profile`
│   │       ├── missions.py                       # `/api/missions/*` CRUD, BOM analysis, live discovery, RFQ generation, quote parsing, delay simulation, voice commands
│   │       ├── suppliers.py                      # `GET /api/suppliers`, `GET /api/suppliers/:id`
│   │       ├── chat.py                           # `POST /api/chat`, `GET /api/chat/history`, `POST /api/suppliers/discover`
│   │       ├── rfqs.py                           # `GET /api/rfqs`, `POST /api/rfqs/:id/send`
│   │       ├── approvals.py                      # `GET /api/approvals`, `POST /api/approvals/:id/approve`, `POST /api/approvals/:id/reject`
│   │       ├── risks.py                          # `GET /api/risks`
│   │       ├── audit.py                          # `GET /api/audit`
│   │       └── webhooks.py                       # `POST /api/webhooks/supplier-response`, `POST /api/webhooks/external-event`, `POST /api/webhooks/approval`
│   │
│   └── tests/                                    # Automated Backend Unit & Integration Tests (9 Modules)
│       ├── test_auth.py                          # Tests user signup, login, session persistence, and clean 0-mission initial state
│       ├── test_cost_calculator.py               # Tests INR (`₹`) landed cost math and budget variance
│       ├── test_constraint_checker.py            # Tests MOQ, unit cost, total budget, and lead time constraint validation
│       ├── test_policy_engine.py                 # Tests deterministic `AUTO_EXECUTE` vs `REQUIRE_APPROVAL` policy enforcement
│       ├── test_supplier_search.py               # Tests live supplier discovery, ranking, and non-fabrication of missing fields
│       ├── test_rfq_generation.py                # Tests commercial RFQ generation and dispatch
│       ├── test_recovery_workflow.py             # Tests 25d -> 42d supplier delay detection, alternative discovery, and approval gating
│       ├── test_approvals.py                     # Tests human approval/rejection state transitions and audit logging
│       └── test_webhooks.py                      # Tests n8n inbound webhooks for supplier quotes and external delay events
│
├── src/                                          # React + TypeScript Frontend
│   ├── main.tsx                                  # React DOM root mounting and `BrowserRouter` setup
│   ├── App.tsx                                   # Application shell, authentication guard, theme state, and global `VendraChatbot` drawer
│   ├── index.css                                 # Tailwind CSS v4 import (`@import "tailwindcss";`)
│   │
│   ├── api/
│   │   └── client.ts                             # Typed REST API client, TypeScript interfaces (`Mission`, `Supplier`, `SourcingRequirement`, `ChatMessage`, etc.), and `formatINR` formatter
│   │
│   ├── components/                               # Reusable UI Components
│   │   ├── Navbar.tsx                            # Top operational bar with mission creation shortcut, AI Chatbot toggle, theme switch, and user session controls
│   │   ├── Sidebar.tsx                           # Left navigation sidebar with real-time badge counts and "Try Demo Scenario" loader
│   │   ├── VendraChatbot.tsx                     # Vendra AI Sourcing Chatbot (works both as a global slide-over drawer and embedded inside MissionDetail)
│   │   ├── SupplierTable.tsx                     # Provenance-aware supplier table displaying `LIVE_WEB_SEARCH` badges, clickable source URLs, matched BOM requirements, and RFQ verification statuses
│   │   ├── MissionCard.tsx                       # Summary card for sourcing missions with state badge and KPI counters
│   │   ├── MissionTimeline.tsx                   # Visual state-machine progress tracker (`DRAFT -> ... -> COMPLETED`)
│   │   ├── CostBreakdownCard.tsx                 # Tabular INR (`₹`) landed cost sheet and budget variance breakdown
│   │   ├── RFQModal.tsx                          # Modal displaying full generated commercial RFQ document text and dispatch action
│   │   ├── RiskAlertCard.tsx                     # Supply chain disruption alert card with side-by-side recovery options
│   │   ├── ApprovalModal.tsx                     # Human-in-the-loop contract award inspection modal (`Approve` / `Reject`)
│   │   ├── AuditTimeline.tsx                     # Chronological governance ledger showing actor, policy decision, input/output refs, and timestamps
│   │   ├── VoicePanel.tsx                        # ElevenLabs voice command input and spoken response panel
│   │   ├── OpportunityCard.tsx                   # Market intelligence card separating Fact, Inference, and Product Hypothesis
│   │   ├── ThemeToggle.tsx                       # Light / Dark mode switcher
│   │   ├── EmptyState.tsx                        # Clean empty workspace state component
│   │   ├── LoadingState.tsx                      # Loading spinner component
│   │   └── ErrorState.tsx                        # Error display and retry action component
│   │
│   └── pages/                                    # 15 Application Views
│       ├── Landing.tsx                           # Public product overview page with architecture walkthrough and Demo Scenario launcher
│       ├── Login.tsx                             # Founder sign-in view
│       ├── Signup.tsx                            # New founder account registration view
│       ├── Onboarding.tsx                        # Founder company & procurement cluster profile setup
│       ├── Dashboard.tsx                         # Executive procurement command center with KPIs, active missions, and pending approvals
│       ├── Missions.tsx                          # Filterable directory of the user's sourcing missions
│       ├── CreateMission.tsx                     # 3-step mission builder: (1) AI Product → BOM Decomposition, (2) Editable Requirements & Search Queries, (3) Commercial Specs & Launch
│       ├── MissionDetail.tsx                     # Complete mission workspace: BOM editor, Live Web Supplier Table, RFQ manager, Quote Parser, Landed Cost Cards, Risk Recovery, Voice Panel, Embedded AI Chatbot, and Audit Ledger
│       ├── Suppliers.tsx                         # Direct Real-Time Live Internet Supplier Discovery engine & provenance directory
│       ├── RFQs.tsx                              # Global Request for Quotations dispatch center
│       ├── Approvals.tsx                         # Human-in-the-Loop approval queue (`PENDING`, `APPROVED`, `REJECTED`)
│       ├── Risks.tsx                             # Supply chain risk radar and autonomous recovery log
│       ├── AuditLog.tsx                          # Full system-wide immutable audit trail
│       ├── Opportunities.tsx                     # News API market signal radar with one-click conversion to a Sourcing Mission
│       └── Settings.tsx                          # Integration health status (`Gemini`, `ElevenLabs`, `News API`, `n8n`, `Render`) and founder profile settings
│
├── n8n/                                          # n8n Automation Workflows
│   ├── README.md                                 # Guide for importing and connecting n8n webhooks to Vendra
│   └── workflows/
│       └── vendra_supplier_event_workflow.json   # Exported n8n workflow JSON for automated supplier quote & disruption webhooks
│
└── scripts/                                      # Operational CLI Scripts
    ├── seed_demo.py                              # CLI script to initialize schema and seed the isolated demo supplier catalog
    └── reset_demo.py                             # CLI script to reset demo missions and restore a clean demo state
```

---

## 5. How to Run & Test Locally

### Prerequisites
- **Node.js** `>= 20.x` and **npm**
- **Python** `>= 3.10`

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env` (or export variables in your environment):

```bash
cp .env.example .env
```

| Environment Variable | Required? | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Recommended** | Backend-only Google Gemini API key used for AI product decomposition, RFQ drafting, chatbot reasoning, and search grounding. Never exposed to the frontend. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.1-flash-lite-preview` (automatically falls back across available Gemini Flash models). |
| `VENDRA_SQLITE_PATH` | Optional | Path to the SQLite database file (defaults to `backend/vendra.db`). |
| `ELEVENLABS_API_KEY` | Optional | Enables live TTS voice synthesis in the Voice Command Panel. |
| `NEWS_API_KEY` | Optional | Enables live NewsAPI article fetching in the Opportunity Radar page. |
| `N8N_WEBHOOK_SECRET` | Optional | Shared secret for authenticating inbound n8n supplier/event webhooks. |

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the Full-Stack Application
```bash
npm run dev
```
- Starts the **Express + Vite Gateway** on **`http://localhost:3000`**.
- Automatically spawns and manages the **Python Backend Server** (`backend/app/main.py`) on **`http://127.0.0.1:8001`**.
- Runs database migrations automatically on startup (`001_initial_schema.sql` + live provenance columns).

### Step 4: Try Live Internet Supplier Discovery & Vendra AI Chatbot
1. **Create a Normal Account**: Click **Sign Up** to create a fresh founder account (starts with `0` fake missions).
2. **Search Live Suppliers Directly**:
   - Open **Suppliers** (`/suppliers`) from the left sidebar.
   - Enter any product or material (e.g., `Spiral Binded Notebooks`, `70 GSM Maplitho Paper`, `300 GSM Duplex Board`, `Insulated Stainless Steel Water Bottle`, `Organic Cotton Tote Bag`) and location (`Bengaluru`, `Tiruppur`, `Delhi`, etc.), then click **Search Live Internet**.
   - Inspect the decomposed requirements, executed search queries, live web supplier results, clickable source links, and honest verification statuses (`Quote required` / `Not publicly listed`).
3. **Create & Launch a Mission**:
   - Click **New Mission** (`/missions/new`).
   - Enter a natural language goal in Step 1 and click **Analyze Product & Decompose Materials / Components**.
   - Review or edit the decomposed BOM items and search terms in Step 2, then click **Launch Mission & Run Live Internet Supplier Discovery**.
4. **Use the Vendra AI Chatbot**:
   - Click the **AI Chatbot** button in the top navbar (or use the embedded chatbot inside any Mission Workspace) to decompose products, run live internet supplier searches, create missions, dispatch RFQs, or trigger delay recovery conversationally.
5. **Try the Isolated Demo Scenario (Optional)**:
   - Click **Try Demo Scenario** in the sidebar to inspect the pre-populated demo mission and test the scripted Supplier B delay (`25 days → 42 days`) and Human Approval Gate workflow.

### Step 5: Run the Automated Test Suite
```bash
python3 -m unittest discover -s backend/tests -p "test_*.py" -v
```

### Step 6: Production Build
```bash
npm run build
npm start
```
