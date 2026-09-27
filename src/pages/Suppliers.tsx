import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  Search,
  Cpu,
  RefreshCw,
  Sparkles,
  FileText,
  Send,
  Edit3,
  ExternalLink,
  Check,
  Activity,
  Layers,
  Scale,
  MessageSquare,
  X,
  Plus,
} from 'lucide-react';
import {
  api,
  Supplier,
  SourcingRequirement,
  SourcingActivity,
  Mission,
  RFQ,
  SupplierResponseItem,
  formatINR,
  formatDateShort,
  formatTimeIST,
} from '../api/client';
import {
  SupplierTable,
  formatSupplierTypeLabel,
} from '../components/SupplierTable';
import { RFQModal } from '../components/RFQModal';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface SuppliersProps {
  theme: 'light' | 'dark';
}

type SupplierTab = 'DISCOVER' | 'COMPARE' | 'RFQS' | 'RESPONSES' | 'ACTIVITY';

const QUICK_SEARCH_EXAMPLES = [
  { product: 'Spiral Binded Notebooks', location: 'Bengaluru' },
  { product: '70 GSM Maplitho Paper', location: 'Bengaluru' },
  { product: '300 GSM Duplex Board', location: 'Bengaluru' },
  { product: 'Metal Spiral Binding Wire', location: 'Bengaluru' },
  { product: 'Insulated Stainless Steel Water Bottle', location: 'Bengaluru' },
  { product: 'Organic Cotton Tote Bag', location: 'Tiruppur' },
];

function formatReqTypeLabel(t?: string): string {
  const low = (t || 'raw_material').toLowerCase();
  if (low === 'raw_material') return 'Raw Material';
  if (low === 'component') return 'Component';
  if (low === 'packaging') return 'Packaging';
  if (low === 'process') return 'Manufacturing Process';
  return t || 'Raw Material';
}

export const Suppliers: React.FC<SuppliersProps> = ({ theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<SupplierTab>('DISCOVER');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [activities, setActivities] = useState<SourcingActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Filters & Modes
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedSupplierType, setSelectedSupplierType] = useState('ALL');
  const [activeRequirementFilter, setActiveRequirementFilter] =
    useState<string>('ALL');
  const [sourceMode, setSourceMode] = useState<
    'CURRENT_SEARCH' | 'LIVE_ONLY' | 'DEMO_ONLY'
  >('LIVE_ONLY');

  // Direct Live Internet Supplier Search state
  const [liveProductQuery, setLiveProductQuery] = useState(
    'Spiral Binded Notebooks',
  );
  const [liveLocationQuery, setLiveLocationQuery] = useState('Bengaluru');
  const [liveQuantity, setLiveQuantity] = useState<number>(1000);
  const [liveUnitBudget, setLiveUnitBudget] = useState<number>(250);
  const [liveDeadline, setLiveDeadline] = useState<number>(30);

  const [liveSearching, setLiveSearching] = useState(false);
  const [searchingRequirementName, setSearchingRequirementName] = useState<
    string | null
  >(null);
  const [activeSearchLabel, setActiveSearchLabel] = useState<string | null>(
    null,
  );
  const [currentSearchSuppliers, setCurrentSearchSuppliers] = useState<
    Supplier[]
  >([]);
  const [decomposedReqs, setDecomposedReqs] = useState<SourcingRequirement[]>(
    [],
  );
  const [lastExecutedQueries, setLastExecutedQueries] = useState<string[]>([]);

  // Compare Shortlist state
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [selectedMissionSupplierId, setSelectedMissionSupplierId] = useState<
    string | null
  >(null);

  // RFQ Modal state
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [rfqEditMode, setRfqEditMode] = useState(false);

  // Response Modal & Log Quote state
  const [viewingResponse, setViewingResponse] =
    useState<SupplierResponseItem | null>(null);
  const [loggingQuoteForSupplier, setLoggingQuoteForSupplier] =
    useState<Supplier | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteMoq, setQuoteMoq] = useState('');
  const [quoteLeadTime, setQuoteLeadTime] = useState('');
  const [quotePaymentTerms, setQuotePaymentTerms] = useState(
    '30% Advance, 70% Pre-Dispatch',
  );
  const [quoteMessage, setQuoteMessage] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  const loadWorkspaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, msnListRes, rfqRes, actRes] = await Promise.all([
        api.listSuppliers(true),
        api.listMissions().catch(() => ({ missions: [] as Mission[] })),
        api.listRFQs().catch(() => ({ rfqs: [] as RFQ[] })),
        api
          .listSourcingActivities()
          .catch(() => ({ activities: [] as SourcingActivity[] })),
      ]);

      const supList = supRes.suppliers || [];
      setSuppliers(supList);
      setRfqs(rfqRes.rfqs || []);
      setActivities(actRes.activities || []);

      const mList = msnListRes.missions || [];
      setMissions(mList);

      if (mList.length > 0) {
        const primaryMsnSummary =
          mList.find((m) => !m.is_demo) || mList[0];
        try {
          const detailRes = await api.getMission(primaryMsnSummary.id);
          const fullMsn = detailRes.mission;
          setActiveMission(fullMsn);
          setLiveProductQuery(fullMsn.product_name || 'Spiral Binded Notebooks');
          setLiveLocationQuery(
            (fullMsn.preferred_sourcing_location || 'Bengaluru').split(',')[0].trim(),
          );
          setLiveQuantity(fullMsn.quantity || 1000);
          setLiveUnitBudget(fullMsn.target_unit_cost || 250);
          setLiveDeadline(fullMsn.delivery_deadline || 30);
          setSelectedMissionSupplierId(fullMsn.selected_supplier_id || null);

          if (fullMsn.requirements && fullMsn.requirements.length > 0) {
            setDecomposedReqs(fullMsn.requirements);
          } else {
            const analyzed = await api
              .analyzeProduct({
                product_name: fullMsn.product_name,
                material: fullMsn.material,
                preferred_sourcing_location: fullMsn.preferred_sourcing_location,
                quantity: fullMsn.quantity,
                target_unit_cost: fullMsn.target_unit_cost,
                delivery_deadline: fullMsn.delivery_deadline,
              })
              .catch(() => null);
            if (analyzed?.requirements) {
              setDecomposedReqs(analyzed.requirements);
            }
          }

          if (fullMsn.search_queries && fullMsn.search_queries.length > 0) {
            setLastExecutedQueries(fullMsn.search_queries);
          }
        } catch {
          // ignore detail fetch error
        }
      } else {
        // Decompose default product so material requirement cards are immediately visible
        const analyzed = await api
          .analyzeProduct({
            product_name: 'Spiral Binded Notebooks',
            preferred_sourcing_location: 'Bengaluru, Karnataka',
            quantity: 1000,
            target_unit_cost: 250,
            delivery_deadline: 30,
          })
          .catch(() => null);
        if (analyzed?.requirements) {
          setDecomposedReqs(analyzed.requirements);
        }
      }

      const liveOnly = supList.filter(
        (s) => !s.demo_supplier && s.discovery_source !== 'FALLBACK_CATALOG',
      );
      if (liveOnly.length > 0 && shortlistedIds.length === 0) {
        setShortlistedIds(liveOnly.slice(0, 3).map((s) => s.supplier_id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier procurement hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleSelectMissionContext = async (missionId: string) => {
    try {
      const detailRes = await api.getMission(missionId);
      const m = detailRes.mission;
      setActiveMission(m);
      setLiveProductQuery(m.product_name);
      setLiveLocationQuery(
        (m.preferred_sourcing_location || 'Bengaluru').split(',')[0].trim(),
      );
      setLiveQuantity(m.quantity || 1000);
      setLiveUnitBudget(m.target_unit_cost || 250);
      setLiveDeadline(m.delivery_deadline || 30);
      setSelectedMissionSupplierId(m.selected_supplier_id || null);
      if (m.requirements && m.requirements.length > 0) {
        setDecomposedReqs(m.requirements);
      }
      if (m.suppliers && m.suppliers.length > 0) {
        setCurrentSearchSuppliers(m.suppliers);
        setActiveSearchLabel(`${m.product_name} (${m.preferred_sourcing_location})`);
        setSourceMode('CURRENT_SEARCH');
        setShortlistedIds(m.suppliers.slice(0, 3).map((s) => s.supplier_id));
      }
    } catch (err: any) {
      setError(err.message || 'Could not switch mission context.');
    }
  };

  const executeLiveSearch = async (
    prod: string,
    loc: string,
    focusReq?: string,
  ) => {
    const trimmedProd = prod.trim();
    const trimmedLoc = loc.trim() || 'Bengaluru';
    if (!trimmedProd) return;

    setLiveSearching(true);
    setSearchingRequirementName(focusReq || null);
    setError(null);
    setActionBanner(null);

    try {
      const res = await api.discoverSuppliersLive({
        id: activeMission?.id,
        product: trimmedProd,
        location: trimmedLoc,
        quantity: liveQuantity,
        requirements: focusReq ? decomposedReqs : undefined,
        focus_requirement: focusReq,
        target_budget: liveQuantity * liveUnitBudget,
        deadline: liveDeadline,
      });

      const freshLive = res.suppliers || [];
      setCurrentSearchSuppliers(freshLive);
      setActiveSearchLabel(
        focusReq
          ? `${focusReq} — ${trimmedProd} (${trimmedLoc})`
          : `${trimmedProd} (${trimmedLoc})`,
      );
      if (res.requirements && res.requirements.length > 0) {
        setDecomposedReqs(res.requirements);
      }
      setLastExecutedQueries(res.search_queries || []);
      setSourceMode('CURRENT_SEARCH');
      setSelectedCity('ALL');
      setSelectedSupplierType('ALL');
      setActiveRequirementFilter(focusReq || 'ALL');
      setSearch('');

      if (freshLive.length > 0) {
        setShortlistedIds((prev) => {
          const combined = Array.from(
            new Set([...freshLive.slice(0, 3).map((s) => s.supplier_id), ...prev]),
          );
          return combined.slice(0, 6);
        });
      }

      if (res.sourcing_activity) {
        setActivities((prev) => [res.sourcing_activity!, ...prev]);
      }

      const allRes = await api.listSuppliers(true);
      setSuppliers(allRes.suppliers || []);
    } catch (err: any) {
      setError(err.message || 'Live internet supplier search failed.');
    } finally {
      setLiveSearching(false);
      setSearchingRequirementName(null);
    }
  };

  const handleRunLiveInternetSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLiveSearch(liveProductQuery, liveLocationQuery);
  };

  const handleToggleShortlist = (supplier: Supplier) => {
    setShortlistedIds((prev) =>
      prev.includes(supplier.supplier_id)
        ? prev.filter((id) => id !== supplier.supplier_id)
        : [...prev, supplier.supplier_id],
    );
  };

  const ensureMissionForProcurement = async (): Promise<Mission> => {
    if (activeMission) {
      return activeMission;
    }
    const created = await api.createMission({
      mission_name: `${liveProductQuery} Manufacturing Mission`,
      product_name: liveProductQuery,
      product_description: `Upstream raw-material & component sourcing for ${liveQuantity} units of ${liveProductQuery}`,
      product_category: 'Manufactured Goods',
      quantity: liveQuantity,
      target_unit_cost: liveUnitBudget,
      maximum_budget: liveQuantity * liveUnitBudget,
      preferred_sourcing_location: liveLocationQuery,
      delivery_deadline: liveDeadline,
      requirements: decomposedReqs,
      launch_immediately: true,
    });
    setActiveMission(created.mission);
    setMissions((prev) => [created.mission, ...prev]);
    return created.mission;
  };

  const handleGenerateRfqForSupplier = async (supplierId: string) => {
    try {
      setActionBanner(null);
      const msn = await ensureMissionForProcurement();
      const res = await api.createRFQ(msn.id, {
        supplier_id: supplierId,
        auto_send: false,
      });
      const updatedRfqs = await api.listRFQs();
      setRfqs(updatedRfqs.rfqs || []);
      setSelectedRfq(res.rfq);
      setRfqEditMode(false);
      setActiveTab('RFQS');
      setActionBanner(
        `Drafted RFQ ${res.rfq.id} for ${res.rfq.supplier_name}. Review, edit, or dispatch below.`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate RFQ for supplier.');
    }
  };

  const handleSendRfq = async (rfqId: string) => {
    try {
      await api.sendRFQ(rfqId);
      setSelectedRfq(null);
      const updatedRfqs = await api.listRFQs();
      setRfqs(updatedRfqs.rfqs || []);
      setActionBanner(`RFQ ${rfqId} dispatched to supplier.`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch RFQ.');
    }
  };

  const handleSaveRfq = async (rfqId: string, payload: Partial<RFQ>) => {
    try {
      const res = await api.updateRFQ(rfqId, payload);
      setSelectedRfq(res.rfq);
      const updatedRfqs = await api.listRFQs();
      setRfqs(updatedRfqs.rfqs || []);
      setActionBanner(`Saved updates to RFQ ${rfqId}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to save RFQ changes.');
    }
  };

  const handleSubmitSupplierQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingQuoteForSupplier) return;
    setSubmittingQuote(true);
    try {
      const msn = await ensureMissionForProcurement();
      const uPrice = quotePrice.trim() ? Number(quotePrice) : null;
      const mVal = quoteMoq.trim() ? Number(quoteMoq) : null;
      const ltVal = quoteLeadTime.trim() ? Number(quoteLeadTime) : null;

      const updatedMsnRes = await api.processSupplierResponse(msn.id, {
        supplier_id: loggingQuoteForSupplier.supplier_id,
        unit_price: uPrice,
        moq: mVal,
        lead_time_days: ltVal,
        material:
          loggingQuoteForSupplier.matched_requirement ||
          loggingQuoteForSupplier.materials,
        payment_terms: quotePaymentTerms,
        raw_message:
          quoteMessage.trim() ||
          `Quotation from ${loggingQuoteForSupplier.supplier_name || loggingQuoteForSupplier.name} for ${loggingQuoteForSupplier.matched_requirement || liveProductQuery}`,
        auto_request_approval: true,
      });

      setActiveMission(updatedMsnRes.mission);
      setLoggingQuoteForSupplier(null);
      setQuotePrice('');
      setQuoteMoq('');
      setQuoteLeadTime('');
      setQuoteMessage('');
      setActiveTab('RESPONSES');
      setActionBanner(
        `Recorded supplier quotation from ${loggingQuoteForSupplier.supplier_name || loggingQuoteForSupplier.name}.`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to record supplier quote response.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        message="Loading upstream raw-material & component suppliers..."
        theme={theme}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Supplier Discovery Error"
        message={error}
        onRetry={loadWorkspaceData}
        theme={theme}
      />
    );
  }

  const liveLedgerList = suppliers.filter(
    (s) => !s.demo_supplier && s.discovery_source !== 'FALLBACK_CATALOG',
  );
  const demoLedgerList = suppliers.filter((s) => s.demo_supplier);

  const byMode =
    sourceMode === 'CURRENT_SEARCH'
      ? currentSearchSuppliers
      : sourceMode === 'LIVE_ONLY'
      ? liveLedgerList
      : demoLedgerList;

  const cities = [
    'ALL',
    ...Array.from(new Set(byMode.map((s) => s.city).filter(Boolean))),
  ];

  const supplierTypes = [
    'ALL',
    ...Array.from(
      new Set(
        byMode.map((s) => s.supplier_type || 'MANUFACTURER').filter(Boolean),
      ),
    ),
  ];

  const filteredSuppliers = byMode.filter((s) => {
    const matchesCity = selectedCity === 'ALL' || s.city === selectedCity;
    const matchesType =
      selectedSupplierType === 'ALL' ||
      (s.supplier_type || 'MANUFACTURER') === selectedSupplierType;
    const matchesReq =
      activeRequirementFilter === 'ALL' ||
      (s.matched_requirement || '')
        .toLowerCase()
        .includes(activeRequirementFilter.toLowerCase());
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q) ||
      (s.supplier_type || '').toLowerCase().includes(q) ||
      s.manufacturing_capabilities.toLowerCase().includes(q) ||
      s.materials.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.certifications.toLowerCase().includes(q) ||
      (s.matched_requirement || '').toLowerCase().includes(q) ||
      (s.search_query_used || '').toLowerCase().includes(q);
    return matchesCity && matchesType && matchesReq && matchesQuery;
  });

  // Suppliers pool for Compare tab
  const allKnownSuppliers = [
    ...currentSearchSuppliers,
    ...suppliers.filter(
      (s) =>
        !currentSearchSuppliers.some((cs) => cs.supplier_id === s.supplier_id),
    ),
  ];
  const shortlistedSuppliers = allKnownSuppliers.filter((s) =>
    shortlistedIds.includes(s.supplier_id),
  );

  // Responses list from activeMission
  const supplierResponses: SupplierResponseItem[] =
    activeMission?.supplier_responses || [];

  return (
    <div className="space-y-5">
      {/* Page Title & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Upstream Raw-Material, Component &amp; Manufacturing Procurement
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Supplier Discovery &amp; RFQ Hub
          </h1>
          <p
            className={`mt-1 text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Decompose products into raw materials, components, packaging, and
            processes — then discover and compare real B2B suppliers.
          </p>
        </div>

        {missions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#78716C]">
              Active Mission:
            </span>
            <select
              value={activeMission?.id || ''}
              onChange={(e) => handleSelectMissionContext(e.target.value)}
              className={`rounded border px-2.5 py-1.5 font-mono text-xs font-semibold ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                  : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
              }`}
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mission_name} ({m.quantity} units ·{' '}
                  {m.preferred_sourcing_location})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionBanner && (
        <div className="flex items-center justify-between rounded border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-mono">{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="p-0.5 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 5-Tab Navigation Bar */}
      <div
        className={`flex flex-wrap items-center gap-1 border-b pb-2 ${
          isLight ? 'border-[#E7E5E4]' : 'border-[#292524]'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('DISCOVER')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
            activeTab === 'DISCOVER'
              ? 'bg-[#C84B31] text-white'
              : isLight
              ? 'text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#1C1917]'
              : 'text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#F5F5F4]'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          TAB 1 — DISCOVER ({filteredSuppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMPARE')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
            activeTab === 'COMPARE'
              ? 'bg-[#C84B31] text-white'
              : isLight
              ? 'text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#1C1917]'
              : 'text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#F5F5F4]'
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          TAB 2 — COMPARE ({shortlistedSuppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RFQS')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
            activeTab === 'RFQS'
              ? 'bg-[#C84B31] text-white'
              : isLight
              ? 'text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#1C1917]'
              : 'text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#F5F5F4]'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          TAB 3 — RFQs ({rfqs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RESPONSES')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
            activeTab === 'RESPONSES'
              ? 'bg-[#C84B31] text-white'
              : isLight
              ? 'text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#1C1917]'
              : 'text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#F5F5F4]'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          TAB 4 — RESPONSES ({supplierResponses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ACTIVITY')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
            activeTab === 'ACTIVITY'
              ? 'bg-[#C84B31] text-white'
              : isLight
              ? 'text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#1C1917]'
              : 'text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#F5F5F4]'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          TAB 5 — SOURCING ACTIVITY ({activities.length})
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1 — DISCOVER                                                  */}
      {/* ================================================================= */}
      {activeTab === 'DISCOVER' && (
        <div className="space-y-5">
          {/* Top Mission Context Strip */}
          <div
            className={`rounded-md border p-4 ${
              isLight
                ? 'border-[#E7E5E4] bg-white'
                : 'border-[#292524] bg-[#1C1917]'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Mission
                </span>
                <div className="font-semibold truncate mt-0.5">
                  {activeMission?.mission_name || 'Live Upstream Sourcing'}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Product
                </span>
                <div className="font-semibold text-[#C84B31] truncate mt-0.5">
                  {liveProductQuery}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Quantity
                </span>
                <div className="font-semibold mt-0.5">
                  {liveQuantity.toLocaleString('en-IN')} units
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Location
                </span>
                <div className="font-semibold truncate mt-0.5">
                  {liveLocationQuery}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Deadline
                </span>
                <div className="font-semibold mt-0.5">{liveDeadline} days</div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#78716C]">
                  Budget
                </span>
                <div className="font-semibold mt-0.5">
                  {formatINR(liveUnitBudget)}/unit
                </div>
              </div>
            </div>

            {/* Live Search Form */}
            <form
              onSubmit={handleRunLiveInternetSearch}
              className="mt-4 pt-3 border-t border-[#E7E5E4]/60 dark:border-[#292524] grid grid-cols-1 gap-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={liveProductQuery}
                  onChange={(e) => setLiveProductQuery(e.target.value)}
                  placeholder="Enter product to decompose or raw material (e.g. Spiral Binded Notebooks, 70 GSM Paper)..."
                  className={`w-full rounded-md border px-3 py-2 text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={liveLocationQuery}
                  onChange={(e) => setLiveLocationQuery(e.target.value)}
                  placeholder="Location (e.g. Bengaluru)"
                  className={`w-full rounded-md border px-3 py-2 text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={liveSearching}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26] disabled:opacity-50"
                >
                  {liveSearching && !searchingRequirementName ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                  {liveSearching && !searchingRequirementName
                    ? 'Searching Upstream Web...'
                    : 'Decompose & Find Suppliers'}
                </button>
              </div>
            </form>

            {/* Quick Search Examples */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase text-[#78716C]">
                Quick B2B Search:
              </span>
              {QUICK_SEARCH_EXAMPLES.map((ex) => (
                <button
                  key={ex.product}
                  type="button"
                  disabled={liveSearching}
                  onClick={() => {
                    setLiveProductQuery(ex.product);
                    setLiveLocationQuery(ex.location);
                    executeLiveSearch(ex.product, ex.location);
                  }}
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:border-[#C84B31] hover:text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E] hover:border-[#C84B31] hover:text-[#F5F5F4]'
                  }`}
                >
                  {ex.product}
                </button>
              ))}
            </div>
          </div>

          {/* Material / Component Requirements Cards */}
          {decomposedReqs.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                  <Cpu className="h-4 w-4" />
                  Material / Component Requirements ({decomposedReqs.length})
                </div>
                {activeRequirementFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setActiveRequirementFilter('ALL')}
                    className="font-mono text-xs font-semibold text-[#C84B31] hover:underline"
                  >
                    Show All Requirements
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {decomposedReqs.map((req, idx) => {
                  const isSearchingThis = searchingRequirementName === req.name;
                  const isFocused = activeRequirementFilter === req.name;
                  return (
                    <div
                      key={`${req.name}-${idx}`}
                      className={`rounded-md border p-3.5 flex flex-col justify-between transition-colors ${
                        isFocused
                          ? 'border-[#C84B31] bg-[#C84B31]/5'
                          : isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    >
                      <div>
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                          {formatReqTypeLabel(req.type)}
                          {req.supplier_category
                            ? ` · ${req.supplier_category.replace(/_/g, ' ')}`
                            : ''}
                        </div>
                        <div className="font-bold text-xs mt-1 break-words">
                          {req.name}
                        </div>
                        <p
                          className={`mt-1 text-[11px] line-clamp-2 ${
                            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                          }`}
                          title={req.purpose}
                        >
                          {req.purpose}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#E7E5E4]/60 dark:border-[#292524] flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[#78716C] truncate">
                          {req.location || liveLocationQuery}
                        </span>
                        <button
                          type="button"
                          disabled={liveSearching}
                          onClick={() =>
                            executeLiveSearch(
                              liveProductQuery,
                              liveLocationQuery,
                              req.name,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded bg-[#C84B31] px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-[#B03E26] disabled:opacity-50 shrink-0"
                        >
                          {isSearchingThis ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Search className="h-3 w-3" />
                          )}
                          {isSearchingThis ? 'Searching...' : 'Find Suppliers'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source Mode & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {currentSearchSuppliers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSourceMode('CURRENT_SEARCH')}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 font-mono text-xs font-semibold ${
                    sourceMode === 'CURRENT_SEARCH'
                      ? 'border-[#C84B31] bg-[#C84B31] text-white'
                      : isLight
                      ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                      : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Current Search ({currentSearchSuppliers.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSourceMode('LIVE_ONLY')}
                className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 font-mono text-xs font-semibold ${
                  sourceMode === 'LIVE_ONLY'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : isLight
                    ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                    : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                All Web-Discovered ({liveLedgerList.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('DEMO_ONLY')}
                className={`rounded-[4px] border px-3 py-1.5 font-mono text-xs font-semibold ${
                  sourceMode === 'DEMO_ONLY'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : isLight
                    ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                    : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                }`}
              >
                Demo Catalog ({demoLedgerList.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl justify-end">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-[#78716C]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by requirement, type, material, city..."
                  className={`w-full rounded-md border py-1.5 pr-3 pl-8 text-xs ${
                    isLight
                      ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                      : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                  }`}
                />
              </div>

              <select
                value={selectedSupplierType}
                onChange={(e) => setSelectedSupplierType(e.target.value)}
                className={`rounded border px-2.5 py-1.5 font-mono text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                    : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                }`}
              >
                {supplierTypes.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? 'All Supplier Types' : formatSupplierTypeLabel(st)}
                  </option>
                ))}
              </select>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className={`rounded border px-2.5 py-1.5 font-mono text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                    : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
                }`}
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All Cities' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier Results Table */}
          {filteredSuppliers.length === 0 ? (
            <div
              className={`rounded-md border p-8 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#57534E]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No suppliers match the current filter. Click{' '}
              <strong>Find Suppliers</strong> on any Material / Component
              Requirement card above to run a live upstream B2B search.
            </div>
          ) : (
            <SupplierTable
              suppliers={filteredSuppliers}
              selectedSupplierId={selectedMissionSupplierId}
              shortlistedIds={shortlistedIds}
              onToggleShortlist={handleToggleShortlist}
              onGenerateRFQ={handleGenerateRfqForSupplier}
              onSelectForResponse={(sup) => setLoggingQuoteForSupplier(sup)}
              theme={theme}
            />
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2 — COMPARE (Shortlisted Suppliers Only)                      */}
      {/* ================================================================= */}
      {activeTab === 'COMPARE' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                Shortlisted Supplier Comparison ({shortlistedSuppliers.length})
              </h2>
              <p className="text-xs text-[#78716C]">
                Side-by-side comparison of shortlisted upstream raw-material,
                component, and manufacturing suppliers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('DISCOVER')}
              className="rounded border border-[#C84B31]/40 px-3 py-1.5 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/10"
            >
              + Add Suppliers from Discover
            </button>
          </div>

          {shortlistedSuppliers.length === 0 ? (
            <div
              className={`rounded-md border p-8 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#57534E]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No suppliers shortlisted yet. Click <strong>Compare</strong> on
              any supplier in TAB 1 — DISCOVER to compare them here.
            </div>
          ) : (
            <div
              className={`overflow-x-auto rounded-md border ${
                isLight
                  ? 'border-[#E7E5E4] bg-white'
                  : 'border-[#292524] bg-[#1C1917]'
              }`}
            >
              <table className="w-full table-fixed min-w-[960px] text-left text-xs">
                <thead>
                  <tr
                    className={`border-b font-mono text-[11px] uppercase ${
                      isLight
                        ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#78716C]'
                        : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
                    }`}
                  >
                    <th className="px-3.5 py-3 w-[16%]">Supplier</th>
                    <th className="px-3 py-3 w-[12%]">Type</th>
                    <th className="px-3 py-3 w-[15%]">Requirement</th>
                    <th className="px-3 py-3 w-[10%]">Location</th>
                    <th className="px-3 py-3 w-[8%] text-right">MOQ</th>
                    <th className="px-3 py-3 w-[9%] text-right">Price</th>
                    <th className="px-3 py-3 w-[8%] text-right">Lead Time</th>
                    <th className="px-3 py-3 w-[9%]">Certification</th>
                    <th className="px-3 py-3 w-[7%]">Match</th>
                    <th className="px-3 py-3 w-[8%]">Verification</th>
                    <th className="px-3.5 py-3 w-[190px] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]/60 dark:divide-[#292524]">
                  {shortlistedSuppliers.map((s) => {
                    const isSelected =
                      selectedMissionSupplierId === s.supplier_id ||
                      s.is_selected;
                    const isLive =
                      !s.demo_supplier &&
                      s.discovery_source !== 'FALLBACK_CATALOG';
                    const shortMoq =
                      s.demo_supplier || s.moq_verified
                        ? s.moq_display ||
                          `${s.minimum_order_quantity.toLocaleString('en-IN')}`
                        : 'Not listed';
                    const shortPrice =
                      s.demo_supplier || s.price_verified
                        ? s.price_display ||
                          `${formatINR(s.indicative_unit_price_inr)}`
                        : 'Quote required';
                    const shortLt =
                      s.demo_supplier || s.lead_time_verified
                        ? s.lead_time_display || `${s.lead_time_days}d`
                        : 'Not listed';
                    const shortCert =
                      s.certifications && s.certifications !== 'Not verified'
                        ? s.certifications
                        : 'Not verified';
                    const link = s.source_url || s.website || '';

                    return (
                      <tr
                        key={s.supplier_id}
                        className={
                          isSelected
                            ? isLight
                              ? 'bg-emerald-50/60'
                              : 'bg-emerald-950/30'
                            : ''
                        }
                      >
                        <td
                          className="px-3.5 py-3 font-semibold truncate"
                          title={s.supplier_name || s.name}
                        >
                          {s.supplier_name || s.name}
                        </td>
                        <td className="px-3 py-3 font-mono text-[10px] font-semibold text-[#C84B31] truncate">
                          {formatSupplierTypeLabel(s.supplier_type)}
                        </td>
                        <td
                          className="px-3 py-3 truncate"
                          title={s.matched_requirement || s.materials}
                        >
                          {s.matched_requirement || s.materials}
                        </td>
                        <td
                          className="px-3 py-3 truncate"
                          title={s.location || 'Not listed'}
                        >
                          {s.city || s.location || 'Not listed'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums truncate">
                          {shortMoq}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold truncate">
                          {shortPrice}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums truncate">
                          {shortLt}
                        </td>
                        <td
                          className="px-3 py-3 font-mono text-[11px] truncate"
                          title={shortCert}
                        >
                          {shortCert}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                          {s.eligibility_status === 'Eligible'
                            ? 'Eligible'
                            : 'Verify'}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] truncate">
                          {isLive ? 'Web-discovered' : 'Demo'}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMissionSupplierId(s.supplier_id);
                                setActionBanner(
                                  `Selected ${s.supplier_name || s.name} as preferred supplier candidate.`,
                                );
                              }}
                              className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-[#E7E5E4] dark:border-[#292524] hover:border-[#C84B31]'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                            {link && link.startsWith('http') && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[10px] font-semibold text-[#C84B31] hover:border-[#C84B31]"
                              >
                                View Source
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleGenerateRfqForSupplier(s.supplier_id)
                              }
                              className="rounded bg-[#C84B31] px-2 py-1 font-mono text-[10px] font-semibold text-white hover:bg-[#B03E26]"
                            >
                              Generate RFQ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3 — RFQs                                                      */}
      {/* ================================================================= */}
      {activeTab === 'RFQS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                Request for Quotations ({rfqs.length})
              </h2>
              <p className="text-xs text-[#78716C]">
                Manage commercial RFQs for upstream raw materials and
                components. Click View or Edit to open the full RFQ document in
                a side panel.
              </p>
            </div>
          </div>

          {rfqs.length === 0 ? (
            <div
              className={`rounded-md border p-8 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#57534E]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No RFQs generated yet. Click <strong>Generate RFQ</strong> on any
              supplier in TAB 1 — DISCOVER or TAB 2 — COMPARE.
            </div>
          ) : (
            <div
              className={`overflow-x-auto rounded-md border ${
                isLight
                  ? 'border-[#E7E5E4] bg-white'
                  : 'border-[#292524] bg-[#1C1917]'
              }`}
            >
              <table className="w-full table-fixed min-w-[820px] text-left text-xs">
                <thead>
                  <tr
                    className={`border-b font-mono text-[11px] uppercase ${
                      isLight
                        ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#78716C]'
                        : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
                    }`}
                  >
                    <th className="px-4 py-3 w-[12%]">RFQ Code</th>
                    <th className="px-4 py-3 w-[20%]">Supplier</th>
                    <th className="px-4 py-3 w-[22%]">Requirement</th>
                    <th className="px-4 py-3 w-[16%]">Quantity</th>
                    <th className="px-4 py-3 w-[10%]">Status</th>
                    <th className="px-4 py-3 w-[10%]">Created</th>
                    <th className="px-4 py-3 w-[220px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]/60 dark:divide-[#292524]">
                  {rfqs.map((rfq, idx) => {
                    const code = `RFQ-${String(idx + 1).padStart(3, '0')}`;
                    const canSend =
                      rfq.status === 'DRAFT' || rfq.status === 'READY';
                    return (
                      <tr key={rfq.id}>
                        <td className="px-4 py-3 font-mono font-semibold text-[#C84B31]">
                          <div>{code}</div>
                          <div className="text-[10px] font-normal text-[#78716C] truncate">
                            {rfq.id}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 font-semibold truncate"
                          title={rfq.supplier_name}
                        >
                          {rfq.supplier_name}
                        </td>
                        <td
                          className="px-4 py-3 truncate"
                          title={rfq.material || rfq.product_requirements}
                        >
                          {rfq.material || rfq.product_requirements}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {rfq.quantity.toLocaleString('en-IN')} unit
                          production req.
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] font-semibold">
                          <span
                            className={
                              rfq.status === 'SENT' ||
                              rfq.status === 'RESPONDED'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {rfq.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#78716C]">
                          {formatDateShort(rfq.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRfqEditMode(false);
                                setSelectedRfq(rfq);
                              }}
                              className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[10px] font-semibold hover:border-[#C84B31]"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRfqEditMode(true);
                                setSelectedRfq(rfq);
                              }}
                              className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[10px] font-semibold hover:border-[#C84B31]"
                            >
                              Edit
                            </button>
                            {canSend && (
                              <button
                                type="button"
                                onClick={() => handleSendRfq(rfq.id)}
                                className="rounded bg-[#C84B31] px-2 py-1 font-mono text-[10px] font-semibold text-white hover:bg-[#B03E26]"
                              >
                                Send
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveTab('RESPONSES')}
                              className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[10px] text-[#78716C] hover:text-[#1C1917] dark:hover:text-white"
                            >
                              View Response
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4 — RESPONSES                                                 */}
      {/* ================================================================= */}
      {activeTab === 'RESPONSES' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                Supplier Quotation Responses ({supplierResponses.length})
              </h2>
              <p className="text-xs text-[#78716C]">
                Structured commercial quotes received from suppliers. Any field
                omitted by a supplier is shown as &ldquo;Not provided&rdquo;.
              </p>
            </div>
            {allKnownSuppliers.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setLoggingQuoteForSupplier(allKnownSuppliers[0])
                }
                className="inline-flex items-center gap-1.5 rounded bg-[#C84B31] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#B03E26]"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Supplier Quote Response
              </button>
            )}
          </div>

          {supplierResponses.length === 0 ? (
            <div
              className={`rounded-md border p-8 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#57534E]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No supplier responses logged yet. Click{' '}
              <strong>Log Supplier Quote Response</strong> above or{' '}
              <strong>Log Quote</strong> on any supplier row in TAB 1 —
              DISCOVER.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supplierResponses.map((resp) => {
                const quotedPriceStr =
                  resp.unit_price !== null && resp.unit_price !== undefined
                    ? `${formatINR(resp.unit_price)} / unit`
                    : 'Not provided';
                const moqStr =
                  resp.moq !== null && resp.moq !== undefined
                    ? `${resp.moq.toLocaleString('en-IN')} units`
                    : 'Not provided';
                const ltStr =
                  resp.lead_time_days !== null &&
                  resp.lead_time_days !== undefined
                    ? `${resp.lead_time_days} days`
                    : 'Not provided';
                const payStr = resp.payment_terms?.trim()
                  ? resp.payment_terms
                  : 'Not provided';

                return (
                  <div
                    key={resp.id}
                    className={`rounded-md border p-4 space-y-3 ${
                      isLight
                        ? 'border-[#E7E5E4] bg-white'
                        : 'border-[#292524] bg-[#1C1917]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] font-semibold uppercase text-[#78716C]">
                          Supplier
                        </div>
                        <div className="font-bold text-sm truncate">
                          {resp.supplier_name}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                        STATUS: RESPONDED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 font-mono text-xs pt-2 border-t border-[#E7E5E4]/60 dark:border-[#292524]">
                      <div>
                        <span className="text-[10px] text-[#78716C] block">
                          Requirement:
                        </span>
                        <span className="font-semibold text-[#C84B31] truncate block">
                          {resp.material || 'Not provided'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">
                          Quoted Price:
                        </span>
                        <span className="font-semibold">{quotedPriceStr}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">
                          MOQ:
                        </span>
                        <span className="font-semibold">{moqStr}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">
                          Lead Time:
                        </span>
                        <span className="font-semibold">{ltStr}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#78716C] block">
                          Payment Terms:
                        </span>
                        <span className="font-semibold break-words">
                          {payStr}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#E7E5E4]/60 dark:border-[#292524] flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingResponse(resp)}
                        className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2.5 py-1 font-mono text-[11px] font-semibold hover:border-[#C84B31]"
                      >
                        View Full Response
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!shortlistedIds.includes(resp.supplier_id)) {
                            setShortlistedIds((prev) => [
                              ...prev,
                              resp.supplier_id,
                            ]);
                          }
                          setActiveTab('COMPARE');
                        }}
                        className="rounded border border-[#E7E5E4] dark:border-[#292524] px-2.5 py-1 font-mono text-[11px] font-semibold hover:border-[#C84B31]"
                      >
                        Compare
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMissionSupplierId(resp.supplier_id);
                          if (resp.mission_id) {
                            navigate(`/missions/${resp.mission_id}`);
                          }
                        }}
                        className="rounded bg-[#C84B31] px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-[#B03E26]"
                      >
                        Use for Mission
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 5 — SOURCING ACTIVITY                                         */}
      {/* ================================================================= */}
      {activeTab === 'ACTIVITY' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold">
              Live Sourcing Activity &amp; Provenance Log ({activities.length})
            </h2>
            <p className="text-xs text-[#78716C]">
              Audit trail of requirement decompositions, dynamic B2B search
              queries generated, web sources inspected, and verified suppliers
              extracted.
            </p>
          </div>

          {activities.length === 0 ? (
            <div
              className={`rounded-md border p-8 text-center text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#57534E]'
                  : 'border-[#292524] bg-[#1C1917] text-[#A8A29E]'
              }`}
            >
              No live search activity recorded in this session yet. Run a
              search in TAB 1 — DISCOVER to inspect query provenance here.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className={`rounded-md border p-4 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-white'
                      : 'border-[#292524] bg-[#1C1917]'
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-xs items-center">
                    <div>
                      <span className="text-[10px] text-[#78716C] block">
                        Time
                      </span>
                      <span className="font-semibold">
                        {formatTimeIST(act.created_at)} · Live Search
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-[#78716C] block">
                        Requirement
                      </span>
                      <span className="font-semibold text-[#C84B31] break-words">
                        {act.requirement_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#78716C] block">
                        Queries
                      </span>
                      <span className="font-semibold">
                        {act.queries_count} generated
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#78716C] block">
                        Sources / Suppliers
                      </span>
                      <span className="font-semibold">
                        {act.sources_discovered} discovered ·{' '}
                        {act.suppliers_extracted} extracted
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {act.status}
                      </span>
                    </div>
                  </div>

                  {act.queries && act.queries.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#E7E5E4]/60 dark:border-[#292524] font-mono text-[11px] text-[#78716C]">
                      <strong className="text-[#1C1917] dark:text-[#F5F5F4]">
                        Executed B2B Queries:
                      </strong>{' '}
                      {act.queries.map((q) => `“${q}”`).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RFQ Side Panel / Modal */}
      {selectedRfq && (
        <RFQModal
          rfq={selectedRfq}
          initialEditMode={rfqEditMode}
          onClose={() => setSelectedRfq(null)}
          onSend={handleSendRfq}
          onSave={handleSaveRfq}
          theme={theme}
        />
      )}

      {/* Full Supplier Response Modal */}
      {viewingResponse && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            className={`w-full max-w-xl rounded-lg border shadow-xl overflow-hidden ${
              isLight
                ? 'bg-white border-stone-200 text-stone-900'
                : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}
          >
            <div className="px-5 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase text-emerald-600">
                  Supplier Response Detail
                </div>
                <h3 className="text-sm font-bold mt-0.5">
                  {viewingResponse.supplier_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingResponse(null)}
                className="p-1 rounded hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#78716C] block">Quoted Price:</span>
                  <strong>
                    {viewingResponse.unit_price !== null
                      ? `${formatINR(viewingResponse.unit_price)}/unit`
                      : 'Not provided'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#78716C] block">MOQ:</span>
                  <strong>
                    {viewingResponse.moq !== null
                      ? `${viewingResponse.moq.toLocaleString('en-IN')} units`
                      : 'Not provided'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#78716C] block">Lead Time:</span>
                  <strong>
                    {viewingResponse.lead_time_days !== null
                      ? `${viewingResponse.lead_time_days} days`
                      : 'Not provided'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#78716C] block">
                    Total Landed Cost:
                  </span>
                  <strong>
                    {viewingResponse.cost_breakdown?.formatted_total ||
                      'Not provided'}
                  </strong>
                </div>
              </div>
              <div>
                <span className="text-[#78716C] block mb-1">
                  Raw Supplier Message:
                </span>
                <div className="p-3 rounded border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 whitespace-pre-wrap break-words">
                  {viewingResponse.raw_message || 'Not provided'}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-stone-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingResponse(null)}
                className="px-3.5 py-1.5 text-xs font-medium rounded border border-stone-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Quote Response Modal */}
      {loggingQuoteForSupplier && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSubmitSupplierQuote}
            className={`w-full max-w-lg rounded-lg border shadow-xl overflow-hidden ${
              isLight
                ? 'bg-white border-stone-200 text-stone-900'
                : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}
          >
            <div className="px-5 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase text-[#C84B31]">
                  Record Supplier Quotation
                </div>
                <h3 className="text-sm font-bold mt-0.5">
                  {loggingQuoteForSupplier.supplier_name ||
                    loggingQuoteForSupplier.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLoggingQuoteForSupplier(null)}
                className="p-1 rounded hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[11px] text-[#78716C] mb-1">
                    Quoted Price (₹/unit)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    placeholder="e.g. 210"
                    className="w-full rounded border border-stone-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-[#78716C] mb-1">
                    MOQ (Units)
                  </label>
                  <input
                    type="number"
                    value={quoteMoq}
                    onChange={(e) => setQuoteMoq(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full rounded border border-stone-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-[#78716C] mb-1">
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    value={quoteLeadTime}
                    onChange={(e) => setQuoteLeadTime(e.target.value)}
                    placeholder="e.g. 21"
                    className="w-full rounded border border-stone-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[#78716C] mb-1">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={quotePaymentTerms}
                  onChange={(e) => setQuotePaymentTerms(e.target.value)}
                  className="w-full rounded border border-stone-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-[#78716C] mb-1">
                  Supplier Quote Message / Notes
                </label>
                <textarea
                  rows={3}
                  value={quoteMessage}
                  onChange={(e) => setQuoteMessage(e.target.value)}
                  placeholder="Paste supplier quotation details..."
                  className="w-full rounded border border-stone-300 dark:border-slate-700 bg-transparent p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-stone-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLoggingQuoteForSupplier(null)}
                className="px-3 py-1.5 text-xs rounded border border-stone-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingQuote}
                className="inline-flex items-center gap-1 rounded bg-[#C84B31] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {submittingQuote ? 'Saving...' : 'Save Response'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
