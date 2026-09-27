import React from 'react';
import { CostBreakdown, formatINR } from '../api/client';

interface CostBreakdownCardProps {
  supplierName: string;
  cost: CostBreakdown;
  theme?: 'light' | 'dark';
}

export const CostBreakdownCard: React.FC<CostBreakdownCardProps> = ({
  supplierName,
  cost,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  if (!cost || !cost.complete) {
    return (
      <div
        className={`p-4 rounded-lg border text-xs ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-400'
            : 'bg-white border-stone-200 text-stone-600'
        }`}
      >
        <div className="font-semibold">{supplierName} — Cost Breakdown</div>
        <p className="mt-1">
          Unit price not provided in response (`null` / Unknown). Financial engine
          requires a valid unit price to compute landed cost.
        </p>
      </div>
    );
  }

  const variancePositive = (cost.budget_variance ?? 0) >= 0;

  return (
    <div
      className={`p-5 rounded-lg border ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-stone-200 text-stone-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
            Deterministic Cost Engine (INR ₹)
          </h4>
          <p className="text-sm font-semibold mt-0.5">{supplierName}</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs text-stone-500 dark:text-slate-400">
            Landed Unit Cost
          </div>
          <div className="text-sm font-bold tabular-nums">
            ₹{cost.landed_cost?.toFixed(2)}/unit
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs font-mono tabular-nums">
        <div className="flex justify-between">
          <span className={isDark ? 'text-slate-400' : 'text-stone-600'}>
            Ex-Works Unit Price × {cost.quantity.toLocaleString('en-IN')} units
          </span>
          <span>{formatINR(cost.manufacturing_cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className={isDark ? 'text-slate-400' : 'text-stone-600'}>
            Packaging & Labelling
          </span>
          <span>{formatINR(cost.packaging)}</span>
        </div>
        <div className="flex justify-between">
          <span className={isDark ? 'text-slate-400' : 'text-stone-600'}>
            Surface Freight & Logistics
          </span>
          <span>{formatINR(cost.shipping)}</span>
        </div>
        {Boolean(cost.other_known_costs) && (
          <div className="flex justify-between">
            <span className={isDark ? 'text-slate-400' : 'text-stone-600'}>
              Other Known Charges
            </span>
            <span>{formatINR(cost.other_known_costs)}</span>
          </div>
        )}
        <div
          className={`pt-2 border-t flex justify-between font-semibold text-sm ${
            isDark ? 'border-slate-800' : 'border-stone-200'
          }`}
        >
          <span>Total Landed Procurement Cost</span>
          <span>{cost.formatted_total}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span className={isDark ? 'text-slate-400' : 'text-stone-600'}>
            Budget Variance (vs {formatINR(cost.maximum_budget)})
          </span>
          <span
            className={
              variancePositive
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-red-600 dark:text-red-400 font-semibold'
            }
          >
            {variancePositive ? '+' : ''}
            {formatINR(cost.budget_variance)}{' '}
            {variancePositive ? '(Within Budget)' : '(Over Budget)'}
          </span>
        </div>
      </div>
    </div>
  );
};
