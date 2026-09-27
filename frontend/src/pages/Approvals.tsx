import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import {
  api,
  ApprovalItem,
  formatINR,
  formatDateShort,
} from '../api/client';
import { ApprovalModal } from '../components/ApprovalModal';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface ApprovalsProps {
  theme: 'light' | 'dark';
}

export const Approvals: React.FC<ApprovalsProps> = ({ theme }) => {
  const isLight = theme === 'light';
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalItem | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listApprovals();
      setApprovals(res.approvals || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleApprove = async (id: string, notes?: string) => {
    await api.approveRequest(id, notes);
    setSelectedApproval(null);
    await loadApprovals();
  };

  const handleReject = async (id: string, notes?: string) => {
    await api.rejectRequest(id, notes);
    setSelectedApproval(null);
    await loadApprovals();
  };

  if (loading) {
    return (
      <LoadingState message="Loading human approval gates..." theme={theme} />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Approval Gate Error"
        message={error}
        onRetry={loadApprovals}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          Human-in-the-Loop Governance
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Purchase & Supplier Approval Queue ({approvals.length})
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Vendra's deterministic policy engine blocks AI from auto-committing capital. Every supplier award or recovery switch requires explicit founder authorization.
        </p>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          title="No Approval Requests Yet"
          description="When Vendra evaluates supplier quotes or prepares an autonomous recovery plan, approval requests will appear here for your decision."
          theme={theme}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {approvals.map((app) => (
            <div
              key={app.id}
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-white'
                  : 'border-[#292524] bg-[#1C1917]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        app.status === 'PENDING'
                          ? 'border-[#D97706]/40 bg-[#D97706]/10 text-[#D97706]'
                          : app.status === 'APPROVED'
                            ? 'border-[#15803D]/40 bg-[#15803D]/10 text-[#15803D]'
                            : 'border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626]'
                      }`}
                    >
                      {app.status}
                    </span>
                    <span className="font-mono text-xs text-[#78716C]">
                      ID: {app.id}
                    </span>
                    <span className="font-mono text-xs text-[#78716C]">
                      Requested: {formatDateShort(app.requested_at)}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold">
                    {app.supplier_name} — {app.location}
                  </h2>

                  <p
                    className={`text-xs ${
                      isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                    }`}
                  >
                    <strong>Action:</strong> {app.action} |{' '}
                    <strong>Reason:</strong> {app.reason}
                  </p>

                  <p
                    className={`text-xs ${
                      isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                    }`}
                  >
                    <strong>Recommendation Rationale:</strong>{' '}
                    {app.recommendation_rationale}
                  </p>

                  <div className="flex flex-wrap gap-4 pt-2 font-mono text-xs">
                    <span>
                      Quantity: <strong>{app.quantity} units</strong>
                    </span>
                    <span>
                      Unit Price: <strong>{formatINR(app.unit_price)}</strong>
                    </span>
                    <span>
                      Total Cost:{' '}
                      <strong className="text-[#15803D]">
                        {formatINR(app.total_cost)}
                      </strong>
                    </span>
                    <span>
                      Lead Time: <strong>{app.lead_time_days} days</strong>
                    </span>
                    <span>
                      Evidence: <strong>{app.evidence}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedApproval(app)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
                  >
                    {app.status === 'PENDING' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Review & Decide
                      </>
                    ) : (
                      'Inspect Record'
                    )}
                  </button>

                  <Link
                    to={`/missions/${app.mission_id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E7E5E4] px-3 py-2 text-xs font-semibold text-[#78716C] hover:text-[#1C1917]"
                  >
                    Mission
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedApproval && (
        <ApprovalModal
          approval={selectedApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedApproval(null)}
          theme={theme}
        />
      )}
    </div>
  );
};
