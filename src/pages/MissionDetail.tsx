import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  Send,
  AlertTriangle,
  MessageSquarePlus,
  CheckCircle2,
  HelpCircle,
  Globe,
  Cpu,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import {
  api,
  Mission,
  RFQ,
  ApprovalItem,
  SourcingRequirement,
  formatINR,
} from '../api/client';
import { MissionTimeline } from '../components/MissionTimeline';
import { SupplierTable } from '../components/SupplierTable';
import { CostBreakdownCard } from '../components/CostBreakdownCard';
import { RiskAlertCard } from '../components/RiskAlertCard';
import { ApprovalModal } from '../components/ApprovalModal';
import { AuditTimeline } from '../components/AuditTimeline';
import { RFQModal } from '../components/RFQModal';
import { VoicePanel } from '../components/VoicePanel';
import { VendraChatbot } from '../components/VendraChatbot';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface MissionDetailProps {
  theme: 'light' | 'dark';
}

export const MissionDetail: React.FC<MissionDetailProps> = ({ theme }) => {
  const { id } = useParams<{ id: string }>();
  const isLight = theme === 'light';

  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [activeApproval, setActiveApproval] = useState<ApprovalItem | null>(
    null,
  );

  // Supplier response intake state
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState<string>('');
  const [quoteUnitPrice, setQuoteUnitPrice] = useState<string>('128');
  const [quoteMoq, setQuoteMoq] = useState<string>('300');
  const [quoteLeadTime, setQuoteLeadTime] = useState<string>('10');
  const [quoteRawMessage, setQuoteRawMessage] = useState<string>(
    'We can manufacture your order at ₹128 per unit, MOQ 300 units, delivery in 10 days with Food-grade certification and recycled kraft box packaging included.',
  );

  // Ask Vendra Q&A state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  // Decomposed requirements review & edit state
  const [editingReqs, setEditingReqs] = useState(false);
  const [draftReqs, setDraftReqs] = useState<SourcingRequirement[]>([]);

  const loadMission = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMission(id);
      setMission(res.mission);
      setDraftReqs(res.mission.requirements || []);
      if (
        res.mission.suppliers &&
        res.mission.suppliers.length > 0 &&
        !quoteSupplierId
      ) {
        setQuoteSupplierId(res.mission.suppliers[0].supplier_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load mission details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMission();
  }, [id]);

  const handleAnalyzeRequirements = async () => {
    if (!mission) return;
    setActionLoading('analyze');
    setError(null);
    try {
      const res = await api.analyzeMissionRequirements(mission.id);
      setMission(res.mission);
      setDraftReqs(res.mission.requirements || []);
    } catch (err: any) {
      setError(err.message || 'Requirement decomposition failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveRequirements = async () => {
    if (!mission) return;
    setActionLoading('save_reqs');
    setError(null);
    try {
      const res = await api.updateMissionRequirements(mission.id, draftReqs);
      setMission(res.mission);
      setDraftReqs(res.mission.requirements || []);
      setEditingReqs(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save requirements.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscoverSuppliers = async () => {
    if (!mission) return;
    setActionLoading('discover');
    setError(null);
    try {
      const res = await api.discoverSuppliers(mission.id);
      setMission(res.mission);
      setDraftReqs(res.mission.requirements || []);
    } catch (err: any) {
      setError(err.message || 'Supplier discovery failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateRFQs = async (supplierIds?: string[]) => {
    if (!mission) return;
    setActionLoading('rfq');
    setError(null);
    try {
      const res = await api.generateRFQs(mission.id, supplierIds);
      setMission(res.mission);
    } catch (err: any) {
      setError(err.message || 'RFQ generation failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitQuoteResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mission) return;
    setActionLoading('quote');
    setError(null);
    try {
      const res = await api.processSupplierResponse(mission.id, {
        supplier_id: quoteSupplierId || undefined,
        unit_price: quoteUnitPrice ? Number(quoteUnitPrice) : null,
        moq: quoteMoq ? Number(quoteMoq) : null,
        lead_time_days: quoteLeadTime ? Number(quoteLeadTime) : null,
        raw_message: quoteRawMessage,
        auto_request_approval: true,
      });
      setMission(res.mission);
      setShowQuoteForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to process supplier response.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateDelay = async () => {
    if (!mission) return;
    setActionLoading('delay');
    setError(null);
    try {
      const res = await api.simulateSupplierDelay(mission.id, {
        lead_time_days: Math.max((mission.delivery_deadline || 14) + 7, 21),
      });
      setMission(res.mission);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate supplier delay.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (approvalId: string, notes?: string) => {
    setActionLoading('approve');
    try {
      await api.approveRequest(approvalId, notes);
      setActiveApproval(null);
      await loadMission();
    } catch (err: any) {
      setError(err.message || 'Approval failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approvalId: string, notes?: string) => {
    setActionLoading('reject');
    try {
      await api.rejectRequest(approvalId, notes);
      setActiveApproval(null);
      await loadMission();
    } catch (err: any) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAskVendra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mission || !question.trim()) return;
    setAsking(true);
    try {
      const res = await api.askVendra(mission.id, question.trim());
      setAnswer(res.answer);
    } catch (err: any) {
      setAnswer(`Error: ${err.message || 'Unable to answer question.'}`);
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading mission workspace..." theme={theme} />;
  }

  if (error && !mission) {
    return (
      <ErrorState
        title="Mission Load Failed"
        message={error}
        onRetry={loadMission}
        theme={theme}
      />
    );
  }

  if (!mission) return null;

  const suppliers = mission.suppliers || [];
  const rfqs = mission.rfqs || [];
  const responses = mission.supplier_responses || [];
  const risks = mission.risks || [];
  const approvals = mission.approvals || [];
  const auditEvents = mission.audit_events || [];
  const pendingApproval = approvals.find((a) => a.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Top Mission Header & Actions */}
      <div
        className={`rounded-md border p-5 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
                Mission ID: {mission.id}
              </span>
              {mission.is_demo && (
                <span className="rounded-[4px] border border-[#0284C7]/40 bg-[#0284C7]/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#0284C7]">
                  Illustrative Demo Scenario
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {mission.mission_name}
            </h1>
            <p
              className={`mt-1 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              {mission.product_name} — {mission.product_description}
            </p>
          </div>

          {/* Operational Step Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDiscoverSuppliers}
              disabled={actionLoading !== null}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
              }`}
            >
              <Search className="h-3.5 w-3.5 text-[#C84B31]" />
              {actionLoading === 'discover'
                ? 'Discovering...'
                : '1. Discover Suppliers'}
            </button>

            <button
              type="button"
              onClick={() => handleGenerateRFQs()}
              disabled={actionLoading !== null || suppliers.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
              }`}
            >
              <Send className="h-3.5 w-3.5 text-[#C84B31]" />
              {actionLoading === 'rfq'
                ? 'Generating RFQs...'
                : '2. Generate & Send RFQs'}
            </button>

            <button
              type="button"
              onClick={() => setShowQuoteForm(!showQuoteForm)}
              disabled={actionLoading !== null || suppliers.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
              }`}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-[#C84B31]" />
              3. Log Supplier Quote
            </button>

            <button
              type="button"
              onClick={handleSimulateDelay}
              disabled={actionLoading !== null || suppliers.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs font-semibold text-[#DC2626] transition-colors hover:bg-[#DC2626]/20 disabled:opacity-40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {actionLoading === 'delay'
                ? 'Running Recovery...'
                : '4. Simulate Supplier Delay (21d)'}
            </button>
          </div>
        </div>

        {/* Hard Constraints Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-6 border-[#E7E5E4]/60">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Quantity
            </span>
            <p className="font-mono text-sm font-bold tabular-nums">
              {mission.quantity} units
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Target Unit Cost
            </span>
            <p className="font-mono text-sm font-bold tabular-nums">
              {formatINR(mission.target_unit_cost)}
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Maximum Budget
            </span>
            <p className="font-mono text-sm font-bold tabular-nums text-[#C84B31]">
              {formatINR(mission.maximum_budget)}
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Delivery Deadline
            </span>
            <p className="font-mono text-sm font-bold tabular-nums">
              ≤ {mission.delivery_deadline} days
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Certifications
            </span>
            <p className="truncate text-xs font-semibold">
              {mission.certification_requirements || 'Standard'}
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-[#78716C]">
              Preferred Cluster
            </span>
            <p className="truncate text-xs font-semibold">
              {mission.preferred_sourcing_location || 'India'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {/* State Machine Timeline */}
      <MissionTimeline mission={mission} theme={theme} />

      {/* Product -> Material / Component Decomposition & Dynamic Search Queries */}
      <div
        className={`rounded-md border p-5 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Cpu className="h-4 w-4 text-[#C84B31]" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                Product → Material / Component Decomposition ({(mission.requirements || []).length} Requirements)
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                  mission.discovery_mode === 'DEMO_CATALOG'
                    ? 'border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-300'
                    : 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <Globe className="h-3 w-3" />
                {mission.discovery_mode || 'LIVE_WEB_SEARCH'}
              </span>
            </div>
            <p
              className={`mt-1 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Vendra decomposes {mission.product_name} into materials, components, packaging, and manufacturing processes to construct dynamic live internet supplier searches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={handleAnalyzeRequirements}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs font-semibold ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
              }`}
            >
              {actionLoading === 'analyze'
                ? 'Analyzing BOM...'
                : 'Re-Analyze Product'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftReqs(mission.requirements || []);
                setEditingReqs(!editingReqs);
              }}
              className="rounded-md border border-[#C84B31]/40 bg-[#C84B31]/10 px-3 py-1.5 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/20"
            >
              {editingReqs ? 'Cancel Edit' : 'Review & Edit Requirements'}
            </button>
          </div>
        </div>

        {editingReqs ? (
          <div className="mt-4 space-y-3 border-t pt-4 border-[#E7E5E4]/60">
            {draftReqs.map((req, idx) => (
              <div
                key={idx}
                className={`rounded border p-3 ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Requirement Name
                    </label>
                    <input
                      type="text"
                      value={req.name}
                      onChange={(e) =>
                        setDraftReqs((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, name: e.target.value } : r,
                          ),
                        )
                      }
                      className={`mt-1 w-full rounded border px-2 py-1 text-xs font-semibold ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Type
                    </label>
                    <select
                      value={req.type}
                      onChange={(e) =>
                        setDraftReqs((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, type: e.target.value } : r,
                          ),
                        )
                      }
                      className={`mt-1 w-full rounded border px-2 py-1 font-mono text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    >
                      <option value="raw_material">raw_material</option>
                      <option value="component">component</option>
                      <option value="packaging">packaging</option>
                      <option value="process">process</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Search Queries (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={(req.search_terms || []).join(', ')}
                      onChange={(e) =>
                        setDraftReqs((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  search_terms: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 w-full rounded border px-2 py-1 font-mono text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftReqs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="rounded border border-red-500/30 p-1.5 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setDraftReqs((prev) => [
                    ...prev,
                    {
                      name: '',
                      type: 'component',
                      purpose: `Required for ${mission.product_name}`,
                      search_terms: [
                        `${mission.product_name} supplier ${mission.preferred_sourcing_location}`,
                      ],
                      location: mission.preferred_sourcing_location,
                      confidence: 0.9,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Requirement
              </button>
              <button
                type="button"
                disabled={actionLoading === 'save_reqs'}
                onClick={handleSaveRequirements}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26]"
              >
                <Save className="h-3.5 w-3.5" />
                {actionLoading === 'save_reqs'
                  ? 'Saving...'
                  : 'Save Requirements & Update Search Queries'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(mission.requirements || []).map((req, idx) => (
              <div
                key={idx}
                className={`rounded-md border p-3 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-[3px] border border-[#C84B31]/30 bg-[#C84B31]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#C84B31]">
                    {req.type}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    Conf: {Math.round((req.confidence || 0.9) * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 font-semibold">{req.name}</div>
                <div
                  className={`mt-0.5 text-[11px] ${
                    isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                  }`}
                >
                  {req.purpose}
                </div>
                {req.search_terms && req.search_terms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {req.search_terms.map((st, sIdx) => (
                      <span
                        key={sIdx}
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                          isLight
                            ? 'bg-stone-200/70 text-stone-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        🔍 {st}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {mission.search_queries && mission.search_queries.length > 0 && (
          <div
            className={`mt-4 rounded-[4px] border p-3 font-mono text-[11px] ${
              isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E]'
                : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
            }`}
          >
            <strong className="text-[#C84B31]">
              Dynamic Web Search Queries Executed:
            </strong>{' '}
            {mission.search_queries.map((q, i) => (
              <span key={i} className="mr-2 inline-block">
                [{i + 1}] &ldquo;{q}&rdquo;
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Supplier Quote Intake Form (Collapsible) */}
      {showQuoteForm && (
        <div
          className={`rounded-md border p-5 ${
            isLight
              ? 'border-[#C84B31]/40 bg-white'
              : 'border-[#C84B31]/40 bg-[#1C1917]'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase text-[#C84B31]">
                Supplier Quote & Message Parser
              </span>
              <h3 className="text-base font-bold">
                Submit Structured or Unstructured Supplier Quote
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowQuoteForm(false)}
              className="text-xs font-mono text-[#78716C] hover:underline"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmitQuoteResponse} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase">
                  Supplier
                </label>
                <select
                  value={quoteSupplierId}
                  onChange={(e) => setQuoteSupplierId(e.target.value)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase">
                  Quoted Unit Price (₹)
                </label>
                <input
                  type="number"
                  value={quoteUnitPrice}
                  onChange={(e) => setQuoteUnitPrice(e.target.value)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase">
                  Quoted MOQ (Units)
                </label>
                <input
                  type="number"
                  value={quoteMoq}
                  onChange={(e) => setQuoteMoq(e.target.value)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  value={quoteLeadTime}
                  onChange={(e) => setQuoteLeadTime(e.target.value)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                Raw Supplier Email / WhatsApp Message (Parsed by Vendra)
              </label>
              <textarea
                rows={2}
                value={quoteRawMessage}
                onChange={(e) => setQuoteRawMessage(e.target.value)}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={actionLoading === 'quote'}
                className="rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
              >
                {actionLoading === 'quote'
                  ? 'Evaluating Quote & Constraints...'
                  : 'Parse Quote, Calculate Landed INR Cost & Check Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Human Approval Gate Banner */}
      {pendingApproval && (
        <div
          id="approval-gate-section"
          className="rounded-md border-2 border-[#D97706] bg-[#D97706]/5 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="rounded-[4px] border border-[#D97706] bg-[#D97706] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  HUMAN APPROVAL REQUIRED
                </span>
                <span className="font-mono text-xs font-semibold text-[#D97706]">
                  Policy Gate: {pendingApproval.action}
                </span>
              </div>

              <h2 className="mt-2 text-lg font-bold">
                Recommended Supplier: {pendingApproval.supplier_name} (
                {pendingApproval.location})
              </h2>

              <p
                className={`mt-1 text-xs leading-relaxed ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                <strong>Why Vendra recommends this supplier:</strong>{' '}
                {pendingApproval.recommendation_rationale}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs">
                <span>
                  Unit Price:{' '}
                  <strong>{formatINR(pendingApproval.unit_price)}</strong>
                </span>
                <span>
                  Total Landed Cost:{' '}
                  <strong className="text-[#15803D]">
                    {formatINR(pendingApproval.total_cost)}
                  </strong>
                </span>
                <span>
                  Lead Time:{' '}
                  <strong>{pendingApproval.lead_time_days} days</strong>
                </span>
                <span>
                  Evidence: <strong>{pendingApproval.evidence}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveApproval(pendingApproval)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#15803D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#166534]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Inspect & Approve / Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Risk & Autonomous Failure Recovery Section */}
      {risks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#DC2626]">
              Supply Chain Risk Detection & Autonomous Failure Recovery (
              {risks.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {risks.map((risk) => (
              <RiskAlertCard
                key={risk.id}
                risk={risk}
                theme={theme}
                onJumpToApprovals={() => {
                  if (pendingApproval) {
                    setActiveApproval(pendingApproval);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Supplier Discovery & Comparison Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              Supplier Discovery & Multi-Factor Eligibility Matrix (
              {suppliers.length})
            </h2>
            <p
              className={`text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Evaluated deterministically against MOQ ≤ {mission.quantity}, Target Unit Cost ≤ {formatINR(mission.target_unit_cost)}, Total Budget ≤ {formatINR(mission.maximum_budget)}, and Lead Time ≤ {mission.delivery_deadline} days.
            </p>
          </div>
        </div>

        <SupplierTable
          suppliers={suppliers}
          selectedSupplierId={mission.selected_supplier_id}
          theme={theme}
          onGenerateRFQ={(supId) => handleGenerateRFQs([supId])}
          onSelectForResponse={(sup) => {
            setQuoteSupplierId(sup.supplier_id);
            setQuoteUnitPrice(String(sup.indicative_unit_price_inr));
            setQuoteMoq(String(sup.minimum_order_quantity));
            setQuoteLeadTime(String(sup.lead_time_days));
            setShowQuoteForm(true);
          }}
        />
      </div>

      {/* Cost Breakdown & Dispatched RFQs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <h2 className="text-base font-bold">
            Parsed Supplier Quotes & Landed INR Cost Sheets ({responses.length})
          </h2>
          {responses.length === 0 ? (
            <div
              className={`rounded-md border p-6 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#78716C]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No supplier responses recorded yet. Click "3. Log Supplier Quote" above to parse a supplier quote and compute landed INR costs.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {responses.map((resp) => (
                <CostBreakdownCard
                  key={resp.id}
                  supplierName={resp.supplier_name}
                  cost={resp.cost_breakdown}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <h2 className="text-base font-bold">
            Generated RFQs ({rfqs.length})
          </h2>
          {rfqs.length === 0 ? (
            <div
              className={`rounded-md border p-6 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#78716C]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No RFQs generated yet. Click "2. Generate & Send RFQs" to create commercial RFQ packages.
            </div>
          ) : (
            <div className="space-y-2.5">
              {rfqs.map((rfq, idx) => {
                const code = `RFQ-${String(idx + 1).padStart(3, '0')}`;
                return (
                  <div
                    key={rfq.id}
                    className={`flex items-center justify-between gap-3 rounded-md border p-3.5 ${
                      isLight
                        ? 'border-[#E7E5E4] bg-white'
                        : 'border-[#292524] bg-[#1C1917]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#C84B31]">
                          {code}
                        </span>
                        <span className="text-sm font-bold truncate">
                          {rfq.supplier_name}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-[#15803D]">
                          · {rfq.status}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[#78716C] truncate">
                        Requirement: {rfq.material} · Qty:{' '}
                        {rfq.quantity.toLocaleString('en-IN')} units · Deadline: ≤
                        {rfq.delivery_deadline}d
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRfq(rfq)}
                      className="shrink-0 rounded-[4px] border border-[#C84B31]/40 px-2.5 py-1 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/10"
                    >
                      View / Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Voice Control Panel & Vendra AI Sourcing Chatbot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <VoicePanel
            mission={mission}
            onMissionUpdated={(updated) => {
              setMission(updated);
              setDraftReqs(updated.requirements || []);
            }}
            theme={theme}
          />
        </div>

        <div className="lg:col-span-7">
          <VendraChatbot
            theme={theme}
            missionId={mission.id}
            embedded={true}
            onMissionUpdated={(updated) => {
              setMission(updated);
              setDraftReqs(updated.requirements || []);
            }}
          />
        </div>
      </div>

      {/* Full Mission Audit Ledger */}
      <div className="space-y-3">
        <h2 className="text-base font-bold">
          Mission Audit Trail ({auditEvents.length} Events)
        </h2>
        <AuditTimeline events={auditEvents} theme={theme} />
      </div>

      {/* Modals */}
      {selectedRfq && (
        <RFQModal
          rfq={selectedRfq}
          onClose={() => setSelectedRfq(null)}
          onSend={async (rfqId) => {
            await api.sendRFQ(rfqId);
            setSelectedRfq(null);
            await loadMission();
          }}
          onSave={async (rfqId, payload) => {
            const res = await api.updateRFQ(rfqId, payload);
            setSelectedRfq(res.rfq);
            await loadMission();
          }}
          theme={theme}
        />
      )}

      {activeApproval && (
        <ApprovalModal
          approval={activeApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setActiveApproval(null)}
          theme={theme}
        />
      )}
    </div>
  );
};
