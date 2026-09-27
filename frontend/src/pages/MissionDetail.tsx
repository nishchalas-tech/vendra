import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  Send,
  AlertTriangle,
  MessageSquarePlus,
  CheckCircle2,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import {
  api,
  Mission,
  RFQ,
  ApprovalItem,
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

  const loadMission = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMission(id);
      setMission(res.mission);
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

  const handleDiscoverSuppliers = async () => {
    if (!mission) return;
    setActionLoading('discover');
    setError(null);
    try {
      const res = await api.discoverSuppliers(mission.id);
      setMission(res.mission);
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
              {rfqs.map((rfq) => (
                <div
                  key={rfq.id}
                  className={`flex items-center justify-between rounded-md border p-3.5 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-white'
                      : 'border-[#292524] bg-[#1C1917]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">
                        {rfq.supplier_name}
                      </span>
                      <span className="rounded-[4px] border border-[#15803D]/40 bg-[#15803D]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#15803D]">
                        {rfq.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[#78716C]">
                      Qty: {rfq.quantity} | Target: {rfq.pricing_request} | Deadline: ≤{rfq.delivery_deadline}d
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRfq(rfq)}
                    className="rounded-[4px] border border-[#C84B31]/40 px-2.5 py-1 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/10"
                  >
                    Inspect RFQ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Voice Control Panel & Ask Vendra Operational Q&A */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <VoicePanel
            mission={mission}
            onMissionUpdated={(updated) => setMission(updated)}
            theme={theme}
          />
        </div>

        <div className="lg:col-span-6">
          <div
            className={`rounded-md border p-4 ${
              isLight
                ? 'border-[#E7E5E4] bg-white'
                : 'border-[#292524] bg-[#1C1917]'
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#C84B31]" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                Ask Vendra — Operational Mission Analyst
              </span>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                'What is the mission status?',
                'Which supplier is best and why?',
                'What went wrong with delayed suppliers?',
                'What needs my approval right now?',
              ].map((presetQ) => (
                <button
                  key={presetQ}
                  type="button"
                  onClick={() => setQuestion(presetQ)}
                  className={`rounded-[4px] border px-2 py-1 text-[11px] transition-colors ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:border-[#C84B31]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E] hover:border-[#C84B31]'
                  }`}
                >
                  {presetQ}
                </button>
              ))}
            </div>

            <form onSubmit={handleAskVendra} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about costs, constraints, risks, or supplier rationale..."
                className={`flex-1 rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
              <button
                type="submit"
                disabled={asking}
                className="rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
              >
                {asking ? 'Analyzing...' : 'Ask'}
              </button>
            </form>

            {answer && (
              <div
                className={`mt-3 rounded-[4px] border p-3 text-xs leading-relaxed ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                }`}
              >
                {answer}
              </div>
            )}
          </div>
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
