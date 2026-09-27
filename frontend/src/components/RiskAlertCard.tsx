import React from 'react';
import { RiskItem, formatINR } from '../api/client';

interface RiskAlertCardProps {
  risk: RiskItem;
  onJumpToApprovals?: () => void;
  theme?: 'light' | 'dark';
}

export const RiskAlertCard: React.FC<RiskAlertCardProps> = ({
  risk,
  onJumpToApprovals,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const isResolved = risk.status === 'RESOLVED';

  return (
    <div
      className={`p-5 rounded-lg border ${
        isResolved
          ? isDark
            ? 'bg-slate-900 border-slate-800 text-slate-200'
            : 'bg-white border-stone-200 text-stone-800'
          : isDark
          ? 'bg-red-950/25 border-red-900/70 text-slate-100'
          : 'bg-red-50/40 border-red-200 text-stone-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className={`font-bold ${
              isResolved
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            ● {risk.risk_type} ({risk.severity})
          </span>
          <span className="text-stone-400 dark:text-slate-500">·</span>
          <span className="font-semibold">STATUS: {risk.status}</span>
        </div>
        {risk.requires_human_approval && !isResolved && onJumpToApprovals && (
          <button
            type="button"
            onClick={onJumpToApprovals}
            className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md whitespace-nowrap"
          >
            Review Pending Approval Gate
          </button>
        )}
      </div>

      {/* Section 42: 6 Structured Questions */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400">
            1. WHAT CHANGED?
          </div>
          <p className="mt-1 font-medium leading-relaxed">{risk.what_changed}</p>
        </div>

        <div>
          <div className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400">
            2. WHY IS IT A PROBLEM?
          </div>
          <p className="mt-1 leading-relaxed">{risk.why_problem}</p>
        </div>

        <div>
          <div className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400">
            3. WHAT CONSTRAINT FAILED?
          </div>
          <p className="mt-1 font-mono font-semibold text-red-600 dark:text-red-400">
            {risk.constraint_failed}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-stone-500 dark:text-slate-400">
            Expected: {risk.expected_value} | Actual: {risk.actual_value}
          </p>
        </div>

        <div>
          <div className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400">
            4. WHAT DID VENDRA DO?
          </div>
          <p className="mt-1 leading-relaxed">{risk.vendra_action}</p>
        </div>
      </div>

      {/* 5. WHAT OPTIONS EXIST? */}
      {risk.recovery_options && risk.recovery_options.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-slate-800">
          <div className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400 mb-2.5">
            5. WHAT OPTIONS EXIST? (Qualified Recovery Alternatives)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-slate-800 text-[11px] font-mono text-stone-500 dark:text-slate-400">
                  <th className="py-2 pr-3">Alternative Supplier</th>
                  <th className="py-2 px-3">Location</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Total Landed Cost</th>
                  <th className="py-2 px-3 text-right">Lead Time</th>
                  <th className="py-2 pl-3">Constraints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-slate-800 font-mono">
                {risk.recovery_options.map((opt, idx) => (
                  <tr key={opt.supplier_id}>
                    <td className="py-2.5 pr-3 font-sans font-semibold">
                      {idx === 0 ? '★ ' : ''}
                      {opt.supplier_name}
                    </td>
                    <td className="py-2.5 px-3 font-sans">{opt.location}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(opt.unit_price_inr)}/unit
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                      {opt.formatted_total_cost}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {opt.lead_time_days} days
                    </td>
                    <td className="py-2.5 pl-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {opt.all_constraints_passed
                        ? 'ALL PASSED'
                        : 'CONDITIONAL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. WHAT NEEDS HUMAN APPROVAL? */}
      <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase text-stone-500 dark:text-slate-400 mr-2">
            6. WHAT NEEDS HUMAN APPROVAL?
          </span>
          <span>
            Final supplier switch and purchase order commitment require explicit
            Founder approval under Vendra Policy Engine (`HUMAN_APPROVAL`).
          </span>
        </div>
      </div>
    </div>
  );
};
