/**
 * Vendra API Client & Types (src/api/client.ts)
 * Connects the React + TypeScript frontend to the authoritative Python backend.
 */

export interface User {
  id: string;
  full_name: string;
  email: string;
  company_name?: string;
  phone: string;
  city: string;
  state: string;
  is_demo_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface FounderProfile {
  id: string;
  user_id: string;
  full_name: string;
  company_name?: string;
  phone: string;
  city: string;
  state: string;
  business_experience: string;
  skills: string;
  industry_interests: string;
  available_capital: number;
  preferred_product_categories: string;
  available_time: string;
  preferred_sourcing_location: string;
  created_at: string;
  updated_at: string;
}

export interface SourcingRequirement {
  name: string;
  type: 'raw_material' | 'component' | 'packaging' | 'process' | string;
  supplier_category?: string;
  purpose: string;
  search_terms: string[];
  location: string;
  confidence: number;
}

export interface SourcingActivity {
  id: string;
  user_id: string;
  mission_id: string | null;
  requirement_name: string;
  requirement_type: string;
  queries: string[];
  queries_count: number;
  sources_discovered: number;
  suppliers_extracted: number;
  status: string;
  created_at: string;
}

export interface MatchFactors {
  product_capability_match: boolean;
  material_match: boolean;
  moq_compatible: boolean;
  within_budget: boolean;
  unit_price_within_target: boolean;
  lead_time_within_deadline: boolean;
  certification_verified: boolean;
  preferred_location_match: boolean;
  packaging_capable: boolean;
  estimated_landed_unit_inr: number;
  estimated_total_cost_inr: number;
  moq_verified_on_web?: boolean;
  price_verified_on_web?: boolean;
  lead_time_verified_on_web?: boolean;
}

export interface Supplier {
  supplier_id: string;
  supplier_name?: string;
  name: string;
  supplier_type?: string;
  location: string;
  area: string;
  city: string;
  state: string;
  manufacturing_capabilities: string;
  materials: string;
  minimum_order_quantity: number;
  indicative_unit_price_inr: number;
  lead_time_days: number;
  certifications: string;
  packaging_capabilities: string;
  payment_terms: string;
  shipping_regions: string;
  reliability_score: number;
  evidence: string;
  demo_supplier: boolean;
  website?: string;
  source_url?: string;
  source_title?: string;
  source_domain?: string;
  source_snippet?: string;
  discovery_source?: string;
  verification_status?: string;
  search_query_used?: string;
  matched_requirement?: string;
  contact_info?: string;
  confidence_score?: number;
  moq_verified?: boolean;
  price_verified?: boolean;
  lead_time_verified?: boolean;
  moq_display?: string;
  price_display?: string;
  lead_time_display?: string;
  match_factors?: MatchFactors;
  eligibility_status?: string;
  risk_level?: string;
  is_selected?: boolean;
  is_recovery_alternative?: boolean;
}

export interface RFQ {
  id: string;
  mission_id: string;
  user_id: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  product_requirements: string;
  quantity: number;
  material: string;
  quality: string;
  packaging: string;
  certification: string;
  delivery_deadline: number;
  pricing_request: string;
  moq_request: number;
  lead_time_request: number;
  payment_terms: string;
  shipping_requirements: string;
  rfq_body: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostBreakdown {
  currency: string;
  complete: boolean;
  unit_cost: number | null;
  quantity: number;
  manufacturing_cost: number | null;
  packaging: number | null;
  shipping: number | null;
  other_known_costs: number | null;
  landed_cost: number | null;
  total_procurement_cost: number | null;
  maximum_budget?: number;
  target_unit_cost?: number;
  budget_variance: number | null;
  unit_cost_variance?: number | null;
  within_budget?: boolean;
  within_target_unit_cost?: boolean;
  formatted_total: string;
  formatted_landed_unit?: string;
  formatted_budget_variance?: string;
}

export interface ConstraintResult {
  constraint: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'VIOLATED' | 'WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
}

export interface SupplierResponseItem {
  id: string;
  mission_id: string;
  rfq_id: string | null;
  supplier_id: string;
  supplier_name: string;
  raw_message: string;
  unit_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  material: string | null;
  certifications: string | null;
  packaging: string | null;
  payment_terms: string | null;
  shipping_cost_inr: number | null;
  packaging_cost_inr: number | null;
  other_costs_inr: number | null;
  notes: string | null;
  evidence: string;
  cost_breakdown: CostBreakdown;
  constraint_results: ConstraintResult[];
  is_valid_all_constraints: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecoveryOption {
  supplier_id: string;
  supplier_name: string;
  location: string;
  moq: number;
  unit_price_inr: number;
  landed_unit_cost_inr: number;
  total_procurement_cost_inr: number;
  formatted_total_cost: string;
  lead_time_days: number;
  certifications: string;
  reliability_score: number;
  all_constraints_passed: boolean;
  demo_supplier: boolean;
  evidence: string;
}

export interface RiskItem {
  id: string;
  mission_id: string;
  user_id: string;
  supplier_id: string | null;
  supplier_name: string;
  risk_type: string;
  severity: string;
  status: string;
  what_changed: string;
  why_problem: string;
  constraint_failed: string;
  expected_value: string;
  actual_value: string;
  vendra_action: string;
  recovery_options: RecoveryOption[];
  requires_human_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalItem {
  id: string;
  mission_id: string;
  user_id: string;
  action: string;
  reason: string;
  supplier_id: string | null;
  supplier_name: string;
  location: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  lead_time_days: number;
  certification: string;
  risk_summary: string;
  evidence: string;
  recommendation_rationale: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  decision_notes: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEventItem {
  id: string;
  mission_id: string | null;
  user_id: string;
  timestamp: string;
  actor: string;
  event_type: string;
  action: string;
  reason: string;
  input_reference: string;
  output_reference: string;
  policy_decision: string;
  result: string;
}

export interface Mission {
  id: string;
  user_id: string;
  mission_name: string;
  product_name: string;
  product_description: string;
  product_category: string;
  quantity: number;
  target_unit_cost: number;
  maximum_budget: number;
  material: string;
  quality_requirements: string;
  packaging_requirements: string;
  certification_requirements: string;
  preferred_sourcing_location: string;
  delivery_deadline: number;
  additional_requirements: string;
  state: string;
  selected_supplier_id: string | null;
  is_demo: boolean;
  requirements?: SourcingRequirement[];
  search_queries?: string[];
  discovery_mode?: string;
  created_at: string;
  updated_at: string;
  suppliers_count?: number;
  rfqs_count?: number;
  open_risks_count?: number;
  pending_approvals_count?: number;
  suppliers?: Supplier[];
  rfqs?: RFQ[];
  supplier_responses?: SupplierResponseItem[];
  risks?: RiskItem[];
  approvals?: ApprovalItem[];
  audit_events?: AuditEventItem[];
  render_workflow?: {
    current_step: string;
    step_index: number;
    total_steps: number;
    steps: string[];
    has_risk_branch: boolean;
    render_configured: boolean;
    idempotent_retries_enabled: boolean;
  };
}

export interface OpportunityItem {
  id: string;
  signal_title: string;
  source: string;
  source_url?: string;
  published_at: string;
  region: string;
  fact: string;
  inference: string;
  opportunity_hypothesis: string;
  product_idea: string;
  product_specification: {
    product_category: string;
    material: string;
    quantity: number;
    target_unit_cost: number;
    maximum_budget: number;
    certification_requirements: string;
    packaging_requirements: string;
    preferred_sourcing_location: string;
    delivery_deadline: number;
  };
}

export interface ChatMessage {
  id: string;
  user_id: string;
  mission_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  metadata?: {
    action_taken?: string;
    intent?: string;
    mission_id?: string | null;
    mission_state?: string | null;
    discovery_mode?: string;
    suppliers?: Supplier[];
    requirements?: SourcingRequirement[];
    search_queries?: string[];
  };
  created_at: string;
}

export interface ChatResponse {
  reply: string;
  intent: string;
  action_taken: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  suppliers: Supplier[];
  requirements: SourcingRequirement[];
  search_queries: string[];
  mission: Mission | null;
}

const SESSION_TOKEN_KEY = 'vendra_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return 'Unknown';
  }
  const num = Math.round(Number(amount));
  const isNeg = num < 0;
  const s = Math.abs(num).toString();
  let formatted = s;
  if (s.length > 3) {
    const lastThree = s.slice(-3);
    let rem = s.slice(0, -3);
    const groups: string[] = [];
    while (rem.length > 2) {
      groups.unshift(rem.slice(-2));
      rem = rem.slice(0, -2);
    }
    if (rem.length > 0) groups.unshift(rem);
    formatted = `${groups.join(',')},${lastThree}`;
  }
  return isNeg ? `-₹${formatted}` : `₹${formatted}`;
}

export function formatTimeIST(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso.slice(11, 19);
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/register',
  '/auth/login',
  '/auth/signup',
  '/auth/register',
  '/health',
  '/api/health',
]);

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isPublicAuth = PUBLIC_AUTH_PATHS.has(path);
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token && !isPublicAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Vendra could not connect to the backend. Please try again.');
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error('Vendra could not connect to the backend. Please try again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawError = String(data.error || data.detail || '').trim();
    const isLoginPath = path === '/api/auth/login' || path === '/auth/login';
    const isRegisterPath =
      path === '/api/auth/signup' ||
      path === '/api/auth/register' ||
      path === '/auth/signup' ||
      path === '/auth/register';

    if (res.status === 401) {
      if (isLoginPath) {
        if (
          !rawError ||
          rawError.toLowerCase().includes('missing authorization header')
        ) {
          throw new Error('Incorrect email or password.');
        }
        throw new Error(rawError);
      }
      setStoredToken(null);
      throw new Error('Please sign in to continue.');
    }

    if (isRegisterPath && (res.status === 400 || res.status === 409)) {
      if (rawError.toLowerCase().includes('already exists')) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(rawError || 'Registration failed. Please check your details.');
    }

    if (rawError.toLowerCase().includes('missing authorization header')) {
      throw new Error('Please sign in to continue.');
    }

    throw new Error(rawError || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  company_name?: string;
  phone?: string;
  city?: string;
  state?: string;
}

export const api = {
  checkHealth: () =>
    request<{
      status: string;
      service: string;
      integrations?: Record<string, string>;
    }>('/health'),

  register: (payload: RegisterPayload) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  signup: (payload: RegisterPayload) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ status: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  getProfile: () => request<{ profile: FounderProfile }>('/api/profile'),

  updateProfile: (payload: Partial<FounderProfile>) =>
    request<{ profile: FounderProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  listMissions: () => request<{ missions: Mission[] }>('/api/missions'),

  analyzeProduct: (payload: {
    prompt?: string;
    product_name?: string;
    product_description?: string;
    product_category?: string;
    material?: string;
    packaging_requirements?: string;
    certification_requirements?: string;
    preferred_sourcing_location?: string;
    quantity?: number;
    target_unit_cost?: number;
    maximum_budget?: number;
    delivery_deadline?: number;
  }) =>
    request<{
      product: string;
      extracted_constraints: Record<string, any>;
      requirements: SourcingRequirement[];
    }>('/api/missions/analyze-product', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createMission: (
    payload: Partial<Mission> & {
      launch_immediately?: boolean;
      requirements?: SourcingRequirement[];
    },
  ) =>
    request<{ mission: Mission }>('/api/missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMission: (id: string) =>
    request<{ mission: Mission }>(`/api/missions/${id}`),

  updateMission: (id: string, payload: Partial<Mission>) =>
    request<{ mission: Mission }>(`/api/missions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  analyzeMissionRequirements: (id: string) =>
    request<{ mission: Mission }>(`/api/missions/${id}/analyze-requirements`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  updateMissionRequirements: (
    id: string,
    requirements: SourcingRequirement[],
  ) =>
    request<{ mission: Mission }>(`/api/missions/${id}/requirements`, {
      method: 'PUT',
      body: JSON.stringify({ requirements }),
    }),

  launchMission: (id: string) =>
    request<{ mission: Mission }>(`/api/missions/${id}/launch`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  cancelMission: (id: string) =>
    request<{ mission: Mission }>(`/api/missions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  discoverSuppliers: (id: string) =>
    request<{ mission: Mission }>(`/api/missions/${id}/discover-suppliers`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  generateRFQs: (id: string, supplierIds?: string[]) =>
    request<{ mission: Mission }>(`/api/missions/${id}/generate-rfqs`, {
      method: 'POST',
      body: JSON.stringify({ supplier_ids: supplierIds }),
    }),

  processSupplierResponse: (
    id: string,
    payload: {
      supplier_id?: string;
      unit_price?: number | null;
      moq?: number | null;
      lead_time_days?: number | null;
      material?: string;
      certifications?: string;
      packaging?: string;
      payment_terms?: string;
      raw_message?: string;
      auto_request_approval?: boolean;
    },
  ) =>
    request<{ mission: Mission }>(`/api/missions/${id}/process-response`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  simulateSupplierDelay: (
    id: string,
    payload: {
      supplier_id?: string;
      lead_time_days?: number;
      message?: string;
    } = {},
  ) =>
    request<{ mission: Mission }>(`/api/missions/${id}/simulate-delay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  askVendra: (id: string, question: string) =>
    request<{ answer: string; mission_state: string }>(
      `/api/missions/${id}/ask`,
      {
        method: 'POST',
        body: JSON.stringify({ question }),
      },
    ),

  sendVoiceCommand: (id: string, transcript: string) =>
    request<{
      transcript: string;
      structured_command: Record<string, unknown>;
      voice_response_text: string;
      elevenlabs_configured: boolean;
      audio_base64: string | null;
      mission: Mission;
    }>(`/api/missions/${id}/voice-command`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  listSuppliers: (includeDemo = true) =>
    request<{ suppliers: Supplier[] }>(
      `/api/suppliers?include_demo=${includeDemo ? 'true' : 'false'}`,
    ),

  discoverSuppliersLive: (payload: {
    id?: string;
    product?: string;
    product_name?: string;
    quantity?: number;
    requirements?: SourcingRequirement[];
    focus_requirement?: string;
    target_budget?: number;
    location?: string;
    deadline?: number;
    certifications?: string;
  }) =>
    request<{
      product: string;
      location: string;
      focus_requirement?: string | null;
      requirements: SourcingRequirement[];
      search_queries: string[];
      discovery_mode: string;
      suppliers: Supplier[];
      sourcing_activity?: SourcingActivity;
    }>('/api/suppliers/discover', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listSourcingActivities: (missionId?: string) =>
    request<{ activities: SourcingActivity[] }>(
      missionId
        ? `/api/suppliers/activities?mission_id=${encodeURIComponent(missionId)}`
        : '/api/suppliers/activities',
    ),

  sendChatMessage: (payload: { message: string; mission_id?: string | null }) =>
    request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getChatHistory: (missionId?: string | null) =>
    request<{ messages: ChatMessage[] }>(
      missionId
        ? `/api/chat/history?mission_id=${encodeURIComponent(missionId)}`
        : '/api/chat/history',
    ),

  getSupplier: (id: string) =>
    request<{ supplier: Supplier }>(`/api/suppliers/${id}`),

  listRFQs: (missionId?: string) =>
    request<{ rfqs: RFQ[] }>(
      missionId ? `/api/missions/${missionId}/rfqs` : '/api/rfqs',
    ),

  createRFQ: (
    missionId: string,
    payload: { supplier_id: string; auto_send?: boolean },
  ) =>
    request<{ rfq: RFQ }>(`/api/missions/${missionId}/rfqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendRFQ: (rfqId: string) =>
    request<{ rfq: RFQ }>(`/api/rfqs/${rfqId}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  updateRFQ: (rfqId: string, payload: Partial<RFQ>) =>
    request<{ rfq: RFQ }>(`/api/rfqs/${rfqId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  listApprovals: (missionId?: string) =>
    request<{ approvals: ApprovalItem[] }>(
      missionId ? `/api/approvals?mission_id=${missionId}` : '/api/approvals',
    ),

  approveRequest: (approvalId: string, decisionNotes?: string) =>
    request<{ approval: ApprovalItem }>(`/api/approvals/${approvalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision_notes: decisionNotes }),
    }),

  rejectRequest: (approvalId: string, decisionNotes?: string) =>
    request<{ approval: ApprovalItem }>(`/api/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ decision_notes: decisionNotes }),
    }),

  listRisks: (missionId?: string) =>
    request<{ risks: RiskItem[] }>(
      missionId ? `/api/missions/${missionId}/risks` : '/api/risks',
    ),

  listAuditEvents: (missionId?: string) =>
    request<{ audit_events: AuditEventItem[] }>(
      missionId ? `/api/missions/${missionId}/audit` : '/api/audit',
    ),

  getOpportunities: (
    query?: string,
    refreshIndex: number = 0,
    excludeIds: string[] = [],
  ) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (refreshIndex > 0) params.set('refresh', String(refreshIndex));
    if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
    const qs = params.toString();
    return request<{
      news_api_configured: boolean;
      status: string;
      query_used?: string;
      refresh_index?: number;
      message: string;
      opportunities: OpportunityItem[];
    }>(qs ? `/api/opportunities?${qs}` : '/api/opportunities');
  },

  loadDemoScenario: () =>
    request<{
      user: User;
      token: string;
      mission: Mission;
      is_demo: boolean;
    }>('/api/demo/load', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
