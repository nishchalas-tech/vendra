import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Send, ExternalLink } from 'lucide-react';
import { api, RFQ, formatDateShort } from '../api/client';
import { RFQModal } from '../components/RFQModal';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface RFQsProps {
  theme: 'light' | 'dark';
}

export const RFQs: React.FC<RFQsProps> = ({ theme }) => {
  const isLight = theme === 'light';
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);

  const loadRfqs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRFQs();
      setRfqs(res.rfqs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load RFQs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, []);

  const handleSendRfq = async (rfqId: string) => {
    try {
      await api.sendRFQ(rfqId);
      setSelectedRfq(null);
      await loadRfqs();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch RFQ.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading RFQ dispatches..." theme={theme} />;
  }

  if (error) {
    return (
      <ErrorState
        title="RFQ Load Error"
        message={error}
        onRetry={loadRfqs}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          Commercial Procurement
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Request for Quotations ({rfqs.length})
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Structured commercial RFQ sheets generated from mission specifications and dispatched to shortlisted suppliers.
        </p>
      </div>

      {rfqs.length === 0 ? (
        <EmptyState
          title="No RFQs Generated Yet"
          description="Launch a sourcing mission or run RFQ generation inside an existing mission to create structured Request for Quotation documents."
          theme={theme}
        />
      ) : (
        <div
          className={`overflow-x-auto rounded-md border ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b font-mono text-[11px] uppercase ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#78716C]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
                }`}
              >
                <th className="px-4 py-3">RFQ ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Product & Material</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3">Target Pricing</th>
                <th className="px-4 py-3 text-right">Lead Time Cap</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]/50">
              {rfqs.map((rfq) => (
                <tr key={rfq.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#C84B31]">
                    {rfq.id}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {rfq.supplier_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs truncate font-medium">
                      {rfq.product_requirements}
                    </div>
                    <div className="text-[11px] text-[#78716C]">
                      {rfq.material}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {rfq.quantity}
                  </td>
                  <td className="px-4 py-3 font-mono">{rfq.pricing_request}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    ≤ {rfq.delivery_deadline}d
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-[4px] border border-[#15803D]/40 bg-[#15803D]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#15803D]">
                      {rfq.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#78716C]">
                    {formatDateShort(rfq.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRfq(rfq)}
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#C84B31]/40 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#C84B31] hover:bg-[#C84B31]/10"
                      >
                        <FileText className="h-3 w-3" />
                        View Body
                      </button>
                      <Link
                        to={`/missions/${rfq.mission_id}`}
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E5E4] px-2 py-1 font-mono text-[11px] text-[#78716C] hover:text-[#1C1917]"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRfq && (
        <RFQModal
          rfq={selectedRfq}
          onClose={() => setSelectedRfq(null)}
          onSend={handleSendRfq}
          theme={theme}
        />
      )}
    </div>
  );
};
