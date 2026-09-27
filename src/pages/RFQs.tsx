import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, Edit3, MessageSquare } from 'lucide-react';
import { api, RFQ, formatDateShort } from '../api/client';
import { RFQModal } from '../components/RFQModal';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface RFQsProps {
  theme: 'light' | 'dark';
}

export const RFQs: React.FC<RFQsProps> = ({ theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [editMode, setEditMode] = useState(false);

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

  const handleSaveRfq = async (rfqId: string, payload: Partial<RFQ>) => {
    try {
      const res = await api.updateRFQ(rfqId, payload);
      setSelectedRfq(res.rfq);
      await loadRfqs();
    } catch (err: any) {
      setError(err.message || 'Failed to update RFQ.');
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
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            Clean commercial RFQ rows linked to upstream raw-material and
            component suppliers. Click View or Edit to inspect the full RFQ
            document in a side panel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/suppliers')}
          className="rounded-md border border-[#C84B31]/40 bg-[#C84B31]/10 px-3 py-1.5 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/20"
        >
          Open Supplier &amp; RFQ Hub
        </button>
      </div>

      {rfqs.length === 0 ? (
        <EmptyState
          title="No RFQs Generated Yet"
          description="Launch a sourcing mission or generate RFQs from the Suppliers workspace to dispatch commercial Request for Quotation sheets."
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
          <table className="w-full table-fixed min-w-[820px] text-left text-xs">
            <thead>
              <tr
                className={`border-b font-mono text-[11px] uppercase ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#78716C]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
                }`}
              >
                <th className="px-4 py-3 w-[12%]">RFQ ID</th>
                <th className="px-4 py-3 w-[20%]">Supplier</th>
                <th className="px-4 py-3 w-[24%]">Requirement</th>
                <th className="px-4 py-3 w-[14%]">Quantity</th>
                <th className="px-4 py-3 w-[10%]">Status</th>
                <th className="px-4 py-3 w-[10%]">Created</th>
                <th className="px-4 py-3 w-[220px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]/50 dark:divide-[#292524]">
              {rfqs.map((rfq, idx) => {
                const shortCode = `RFQ-${String(idx + 1).padStart(3, '0')}`;
                const canSend =
                  rfq.status === 'DRAFT' || rfq.status === 'READY';
                return (
                  <tr key={rfq.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#C84B31]">
                      <div>{shortCode}</div>
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
                    <td className="px-4 py-3 min-w-0">
                      <div
                        className="font-medium truncate"
                        title={rfq.material}
                      >
                        {rfq.material || 'Raw Material / Component'}
                      </div>
                      <div
                        className="text-[11px] text-[#78716C] truncate"
                        title={rfq.product_requirements}
                      >
                        {rfq.product_requirements}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {rfq.quantity.toLocaleString('en-IN')} units
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold">
                      <span
                        className={
                          rfq.status === 'SENT' || rfq.status === 'RESPONDED'
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
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode(false);
                            setSelectedRfq(rfq);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[11px] font-semibold hover:border-[#C84B31]"
                        >
                          <FileText className="h-3 w-3" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode(true);
                            setSelectedRfq(rfq);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[11px] font-semibold hover:border-[#C84B31]"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                        {canSend && (
                          <button
                            type="button"
                            onClick={() => handleSendRfq(rfq.id)}
                            className="inline-flex items-center gap-1 rounded bg-[#C84B31] px-2 py-1 font-mono text-[11px] font-semibold text-white hover:bg-[#B03E26]"
                          >
                            <Send className="h-3 w-3" />
                            Send
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/missions/${rfq.mission_id}`)}
                          className="inline-flex items-center gap-1 rounded border border-[#E7E5E4] dark:border-[#292524] px-2 py-1 font-mono text-[11px] text-[#78716C] hover:text-[#1C1917] dark:hover:text-white"
                        >
                          <MessageSquare className="h-3 w-3" />
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

      {selectedRfq && (
        <RFQModal
          rfq={selectedRfq}
          initialEditMode={editMode}
          onClose={() => setSelectedRfq(null)}
          onSend={handleSendRfq}
          onSave={handleSaveRfq}
          theme={theme}
        />
      )}
    </div>
  );
};
