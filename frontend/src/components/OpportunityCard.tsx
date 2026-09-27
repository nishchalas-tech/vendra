import React from 'react';
import { ArrowRight } from 'lucide-react';
import { OpportunityItem, formatINR } from '../api/client';

interface OpportunityCardProps {
  opportunity: OpportunityItem;
  onConvertToMission: (opportunity: OpportunityItem) => void;
  converting?: boolean;
  theme?: 'light' | 'dark';
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onConvertToMission,
  converting = false,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const spec = opportunity.product_specification;

  return (
    <div
      className={`p-6 rounded-lg border flex flex-col justify-between ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-stone-200 text-stone-900'
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-stone-500 dark:text-slate-400">
          <span>
            {opportunity.region} · {opportunity.published_at}
          </span>
          <span>{opportunity.source}</span>
        </div>

        <h3 className="mt-2 text-base font-semibold leading-snug">
          {opportunity.signal_title}
        </h3>

        {/* Fact / Inference / Hypothesis separation (Section 33) */}
        <div className="mt-4 space-y-3 text-xs">
          <div
            className={`p-3 rounded border ${
              isDark
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            <span className="font-mono font-semibold text-[11px] uppercase text-emerald-600 dark:text-emerald-400">
              VERIFIED MARKET SIGNAL (FACT):
            </span>
            <p className="mt-1 leading-relaxed">{opportunity.fact}</p>
          </div>

          <div
            className={`p-3 rounded border ${
              isDark
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            <span className="font-mono font-semibold text-[11px] uppercase text-sky-600 dark:text-sky-400">
              SUPPLY CHAIN IMPLICATION (INFERENCE):
            </span>
            <p className="mt-1 leading-relaxed">{opportunity.inference}</p>
          </div>

          <div
            className={`p-3 rounded border ${
              isDark
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            <span className="font-mono font-semibold text-[11px] uppercase text-amber-600 dark:text-amber-400">
              OPPORTUNITY HYPOTHESIS (TESTABLE):
            </span>
            <p className="mt-1 leading-relaxed">
              {opportunity.opportunity_hypothesis}
            </p>
          </div>
        </div>
      </div>

      {/* Product Specification & Mission Draft Conversion */}
      <div className="mt-5 pt-4 border-t border-stone-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs">
            <div className="font-mono text-[11px] uppercase text-stone-500 dark:text-slate-400">
              Proposed Product & Mission Draft
            </div>
            <div className="font-semibold text-sm mt-0.5">
              {opportunity.product_idea}
            </div>
            <div className="font-mono text-[11px] text-stone-500 dark:text-slate-400 mt-1">
              {spec.quantity.toLocaleString('en-IN')} units · Target{' '}
              {formatINR(spec.target_unit_cost)}/u · Max Budget{' '}
              {formatINR(spec.maximum_budget)} · {spec.delivery_deadline} days
            </div>
          </div>

          <button
            type="button"
            disabled={converting}
            onClick={() => onConvertToMission(opportunity)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <span>
              {converting ? 'Creating Mission…' : 'Convert to Mission Draft'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
