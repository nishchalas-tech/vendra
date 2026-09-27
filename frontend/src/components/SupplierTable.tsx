import React from 'react';
import { Supplier, formatINR } from '../api/client';

interface SupplierTableProps {
  suppliers: Supplier[];
  selectedSupplierId?: string | null;
  onGenerateRFQ?: (supplierId: string) => void;
  onSelectForResponse?: (supplier: Supplier) => void;
  theme?: 'light' | 'dark';
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  selectedSupplierId,
  onGenerateRFQ,
  onSelectForResponse,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  if (!suppliers.length) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b uppercase tracking-wider text-[11px] font-semibold ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                  : 'bg-stone-50 border-stone-200 text-stone-500'
              }`}
            >
              <th className="py-3 px-4">Supplier & Cluster</th>
              <th className="py-3 px-3">Materials & Capability</th>
              <th className="py-3 px-3 text-right">MOQ</th>
              <th className="py-3 px-3 text-right">Indicative Price</th>
              <th className="py-3 px-3 text-right">Lead Time</th>
              <th className="py-3 px-3">Certifications</th>
              <th className="py-3 px-3">Match Factors & Status</th>
              {(onGenerateRFQ || onSelectForResponse) && (
                <th className="py-3 px-4 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isDark ? 'divide-slate-800' : 'divide-stone-200'
            }`}
          >
            {suppliers.map((s) => {
              const isSelected =
                s.is_selected || s.supplier_id === selectedSupplierId;
              const mf = s.match_factors;
              return (
                <tr
                  key={s.supplier_id}
                  className={`transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-950/30'
                        : 'bg-emerald-50/60'
                      : isDark
                      ? 'hover:bg-slate-800/40'
                      : 'hover:bg-stone-50/80'
                  }`}
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-semibold text-xs leading-snug">
                      {s.name}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] ${
                        isDark ? 'text-slate-400' : 'text-stone-500'
                      }`}
                    >
                      {s.area}, {s.city}, {s.state}
                    </div>
                    <div
                      className={`mt-1 text-[11px] font-mono ${
                        isDark ? 'text-amber-400/90' : 'text-amber-800'
                      }`}
                    >
                      {s.demo_supplier
                        ? 'Illustrative demo data'
                        : s.evidence}
                    </div>
                    {isSelected && (
                      <div className="mt-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ SELECTED SUPPLIER
                      </div>
                    )}
                    {s.is_recovery_alternative && !isSelected && (
                      <div className="mt-1 text-[11px] font-mono font-semibold text-sky-600 dark:text-sky-400">
                        ↻ RECOVERY ALTERNATIVE
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3 align-top max-w-[220px]">
                    <div className="font-medium">{s.materials}</div>
                    <div
                      className={`mt-1 text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-400' : 'text-stone-500'
                      }`}
                    >
                      {s.manufacturing_capabilities}
                    </div>
                  </td>

                  <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums">
                    {s.minimum_order_quantity.toLocaleString('en-IN')}
                  </td>

                  <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums font-semibold">
                    {formatINR(s.indicative_unit_price_inr)}/unit
                    {mf?.estimated_total_cost_inr && (
                      <div
                        className={`text-[11px] font-normal mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-stone-500'
                        }`}
                      >
                        Est. Landed: {formatINR(mf.estimated_total_cost_inr)}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums">
                    {s.lead_time_days} days
                  </td>

                  <td className="py-3.5 px-3 align-top max-w-[160px]">
                    <div className="text-[11px] leading-relaxed">
                      {s.certifications}
                    </div>
                    <div
                      className={`mt-1 text-[11px] font-mono ${
                        isDark ? 'text-slate-400' : 'text-stone-500'
                      }`}
                    >
                      Reliability: {s.reliability_score}%
                    </div>
                  </td>

                  <td className="py-3.5 px-3 align-top">
                    {s.eligibility_status && (
                      <div
                        className={`font-mono font-semibold ${
                          s.eligibility_status === 'Eligible'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.eligibility_status === 'Conditional'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {s.eligibility_status} · Risk: {s.risk_level || 'Low'}
                      </div>
                    )}
                    {mf && (
                      <div
                        className={`mt-1 text-[11px] font-mono space-y-0.5 ${
                          isDark ? 'text-slate-400' : 'text-stone-600'
                        }`}
                      >
                        <div>
                          MOQ: {mf.moq_compatible ? 'PASS' : 'FAIL'} · Budget:{' '}
                          {mf.within_budget ? 'PASS' : 'FAIL'}
                        </div>
                        <div>
                          Deadline:{' '}
                          {mf.lead_time_within_deadline ? 'PASS' : 'FAIL'} ·
                          Location:{' '}
                          {mf.preferred_location_match ? 'MATCH' : 'OTHER'}
                        </div>
                      </div>
                    )}
                  </td>

                  {(onGenerateRFQ || onSelectForResponse) && (
                    <td className="py-3.5 px-4 align-top text-right space-y-1.5">
                      {onGenerateRFQ && (
                        <div>
                          <button
                            type="button"
                            onClick={() => onGenerateRFQ(s.supplier_id)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                            }`}
                          >
                            Generate & Send RFQ
                          </button>
                        </div>
                      )}
                      {onSelectForResponse && (
                        <div>
                          <button
                            type="button"
                            onClick={() => onSelectForResponse(s)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700'
                                : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                            }`}
                          >
                            Log Quote Response
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
