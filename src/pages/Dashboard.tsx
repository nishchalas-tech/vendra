import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Play,
  FolderKanban,
  AlertTriangle,
  CheckSquare,
  Factory,
  ArrowUpRight,
} from 'lucide-react';
import {
  api,
  Mission,
  ApprovalItem,
  RiskItem,
  AuditEventItem,
  formatINR,
} from '../api/client';
import { MissionCard } from '../components/MissionCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { AuditTimeline } from '../components/AuditTimeline';

interface DashboardProps {
  theme: 'light' | 'dark';
  onLoadDemo: () => void;
  loadingDemo?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  theme,
  onLoadDemo,
  loadingDemo,
}) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [missions, setMissions] = useState<Mission[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, aRes, rRes, auRes] = await Promise.all([
        api.listMissions(),
        api.listApprovals(),
        api.listRisks(),
        api.listAuditEvents(),
      ]);
      setMissions(mRes.missions || []);
      setApprovals(aRes.approvals || []);
      setRisks(rRes.risks || []);
      setAuditEvents((auRes.audit_events || []).slice(0, 8));
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingState message="Loading Mission Control..." theme={theme} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard Sync Error"
        message={error}
        onRetry={fetchDashboardData}
        theme={theme}
      />
    );
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
  const openRisks = risks.filter((r) => r.status === 'OPEN');
  const totalBudgetAllocated = missions.reduce(
    (sum, m) => sum + (Number(m.maximum_budget) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Operational Command Center
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Sourcing Mission Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loadingDemo}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors ${
              isLight
                ? 'border-[#C84B31]/40 bg-[#C84B31]/5 text-[#C84B31] hover:bg-[#C84B31]/10'
                : 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#E05A3F] hover:bg-[#C84B31]/20'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            {loadingDemo ? 'Loading Demo...' : 'Load Bamboo Lunch Box Demo'}
          </button>

          <Link
            to="/missions/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B03E26]"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Create Sourcing Mission
          </Link>
        </div>
      </div>

      {/* KPI Strip (4 cards max in single row) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-md border p-4 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
              Active Missions
            </span>
            <FolderKanban className="h-4 w-4 text-[#C84B31]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
            {missions.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#78716C]">
            Max Budget Pool: {formatINR(totalBudgetAllocated)}
          </p>
        </div>

        <div
          className={`rounded-md border p-4 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
              Pending Approvals
            </span>
            <CheckSquare className="h-4 w-4 text-[#D97706]" />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              pendingApprovals.length > 0 ? 'text-[#D97706]' : ''
            }`}
          >
            {pendingApprovals.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#78716C]">
            Human-in-the-loop gate enforced
          </p>
        </div>

        <div
          className={`rounded-md border p-4 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
              Open Supply Risks
            </span>
            <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              openRisks.length > 0 ? 'text-[#DC2626]' : ''
            }`}
          >
            {openRisks.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#78716C]">
            Lead time, MOQ & budget checks
          </p>
        </div>

        <div
          className={`rounded-md border p-4 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
              Audit Trail Events
            </span>
            <Factory className="h-4 w-4 text-[#15803D]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
            {auditEvents.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#78716C]">
            Deterministic policy verified
          </p>
        </div>
      </div>

      {/* Urgent Action Banner if Pending Approvals exist */}
      {pendingApprovals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-[#D97706]/40 bg-[#D97706]/10 p-4">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
              Human Approval Gate Active ({pendingApprovals.length} Pending)
            </span>
            <p className="mt-0.5 text-sm font-semibold">
              {pendingApprovals[0].supplier_name} —{' '}
              {formatINR(pendingApprovals[0].total_cost)} total cost (
              {pendingApprovals[0].lead_time_days} days lead time)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/missions/${pendingApprovals[0].mission_id}`}
              className="inline-flex items-center gap-1 rounded-md bg-[#D97706] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#B45309]"
            >
              Inspect Mission & Approve
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/approvals"
              className="rounded-md border border-[#D97706]/40 px-3 py-2 text-xs font-semibold text-[#D97706] hover:bg-[#D97706]/10"
            >
              All Approvals
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Sourcing Missions</h2>
            <Link
              to="/missions"
              className="font-mono text-xs font-semibold text-[#C84B31] hover:underline"
            >
              View All Missions →
            </Link>
          </div>

          {missions.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                title="Welcome to Vendra — Create your first manufacturing mission."
                description="Your workspace is clean and ready. Enter your product idea, target quantity, target budget, delivery deadline, material specification, and certification requirements to start discovering verified suppliers."
                actionLabel="Create your first manufacturing mission"
                onAction={() => navigate('/missions/new')}
                theme={theme}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} theme={theme} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Recent Audit Ledger</h2>
            <Link
              to="/audit"
              className="font-mono text-xs font-semibold text-[#C84B31] hover:underline"
            >
              Full Ledger →
            </Link>
          </div>

          <AuditTimeline events={auditEvents} theme={theme} />
        </div>
      </div>
    </div>
  );
};
