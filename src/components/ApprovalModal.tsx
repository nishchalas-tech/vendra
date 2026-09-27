import React, { useState } from 'react';
import { Check, X, HelpCircle } from 'lucide-react';
import { ApprovalItem, formatINR, formatDateShort } from '../api/client';

interface ApprovalModalProps {
  approval: ApprovalItem;
  onApprove: (approvalId: string, notes?: string) => Promise<void>;
  onReject: (approvalId: string, notes?: string) => Promise<void>;
  onClose?: () => void;
  onAskVendra?: (question: string) => Promise<string>;
  theme?: 'light' | 'dark';
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  approval,
  onApprove,
  onReject,
  onClose,
  onAskVendra,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const isPending = approval.status === 'PENDING';

  const handleApproveClick = async () => {
    setSubmitting(true);
    try {
      await onApprove(
        approval.id,
        notes.trim() || 'Approved by founder for procurement execution.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = async () => {
    setSubmitting(true);
    try {
      await onReject(
        approval.id,
        notes.trim() || 'Rejected by founder; evaluate alternative options.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskClick = async () => {
    if (!onAskVendra) return;
    setAsking(true);
    try {
      const answer = await onAskVendra(
        `Why does Vendra recommend ${approval.supplier_name} at ${formatINR(
          approval.total_cost,
        )} and ${approval.lead_time_days} days?`,
      );
      setAiExplanation(answer);
    } finally {
      setAsking(false);
    }
  };

  const content = (
    <div
      className={`p-5 rounded-md border ${
        isPending
          ? isDark
            ? 'bg-[#1C1917] border-[#D97706] text-[#F5F5F4]'
            : 'bg-white border-[#D97706] text-[#1C1917]'
          : isDark
            ? 'bg-[#1C1917] border-[#292524] text-[#F5F5F4]'
            : 'bg-white border-[#E7E5E4] text-[#1C1917]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E7E5E4]/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className={`font-bold ${
                approval.status === 'APPROVED'
                  ? 'text-[#15803D]'
                  : approval.status === 'REJECTED'
                    ? 'text-[#DC2626]'
                    : 'text-[#D97706]'
              }`}
            >
              ● HUMAN APPROVAL GATE · {approval.status}
            </span>
            <span className="text-[#78716C]">·</span>
            <span>Requested {formatDateShort(approval.requested_at)}</span>
          </div>
          <h3 className="text-sm font-semibold mt-1">{approval.action}</h3>
        </div>

        <div className="flex items-center gap-2">
          {onAskVendra && (
            <button
              type="button"
              onClick={handleAskClick}
              disabled={asking}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-[#0C0A09] border-[#292524] text-[#F5F5F4] hover:bg-[#292524]'
                  : 'bg-[#FAF8F5] border-[#E7E5E4] text-[#1C1917] hover:bg-[#F3EFEA]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C84B31]" />
              <span>{asking ? 'Analyzing…' : 'Ask Vendra'}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#E7E5E4]/60 px-2.5 py-1 text-xs font-mono hover:bg-[#F3EFEA]/40"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Core Fields */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[#78716C]">Supplier</span>
          <p className="font-semibold mt-0.5">{approval.supplier_name}</p>
          <p className="text-[11px] text-[#78716C]">{approval.location}</p>
        </div>
        <div>
          <span className="text-[#78716C]">Quantity & Unit Price</span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {approval.quantity.toLocaleString('en-IN')} ×{' '}
            {formatINR(approval.unit_price)}/u
          </p>
        </div>
        <div>
          <span className="text-[#78716C]">Total Landed Cost</span>
          <p className="font-mono font-bold text-sm mt-0.5 tabular-nums text-[#15803D]">
            {formatINR(approval.total_cost)}
          </p>
        </div>
        <div>
          <span className="text-[#78716C]">Confirmed Lead Time</span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {approval.lead_time_days} days
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-mono text-[11px] uppercase text-[#78716C]">
            Reason & Recommendation Rationale
          </span>
          <p className="mt-1 leading-relaxed">{approval.reason}</p>
          {approval.recommendation_rationale && (
            <p className="mt-1 text-[#78716C]">
              {approval.recommendation_rationale}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div>
            <span className="font-mono text-[11px] uppercase text-[#78716C]">
              Certifications:{' '}
            </span>
            <span className="font-medium">{approval.certification}</span>
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase text-[#78716C]">
              Risk Mitigation:{' '}
            </span>
            <span>{approval.risk_summary}</span>
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase text-[#78716C]">
              Evidence Source:{' '}
            </span>
            <span className="font-mono text-[#D97706]">
              {approval.evidence}
            </span>
          </div>
        </div>
      </div>

      {aiExplanation && (
        <div
          className={`mt-4 p-3.5 rounded-[4px] border text-xs leading-relaxed ${
            isDark
              ? 'bg-[#0C0A09] border-[#292524] text-[#F5F5F4]'
              : 'bg-[#FAF8F5] border-[#E7E5E4] text-[#1C1917]'
          }`}
        >
          <div className="font-mono font-semibold text-[11px] uppercase mb-1 text-[#C84B31]">
            Vendra Orchestrator Explanation:
          </div>
          {aiExplanation}
        </div>
      )}

      {/* Decision Controls */}
      {isPending ? (
        <div className="mt-4 pt-4 border-t border-[#E7E5E4]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional decision notes for audit trail…"
            aria-label="Decision notes"
            className={`flex-1 px-3 py-1.5 text-xs rounded-md border ${
              isDark
                ? 'bg-[#0C0A09] border-[#292524] text-[#F5F5F4]'
                : 'bg-[#FAF8F5] border-[#E7E5E4] text-[#1C1917]'
            }`}
          />
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={handleRejectClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md border border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleApproveClick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-md transition-colors whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {submitting ? 'Executing…' : 'Approve & Resume Mission'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 pt-3 border-t border-[#E7E5E4]/60 text-xs font-mono text-[#78716C]">
          Decision recorded ({approval.status}): {approval.decision_notes || '—'}
        </div>
      )}
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-2xl">{content}</div>
      </div>
    );
  }

  return content;
};
