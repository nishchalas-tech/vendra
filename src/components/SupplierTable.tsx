import React, { useState } from 'react';
import {
  ExternalLink,
  Globe,
  FileText,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Supplier, formatINR } from '../api/client';

interface SupplierTableProps {
  suppliers: Supplier[];
  selectedSupplierId?: string | null;
  shortlistedIds?: string[];
  onToggleShortlist?: (supplier: Supplier) => void;
  onGenerateRFQ?: (supplierId: string) => void;
  onSelectForResponse?: (supplier: Supplier) => void;
  theme?: 'light' | 'dark';
}

export function formatSupplierTypeLabel(rawType?: string): string {
  const t = (rawType || 'MANUFACTURER').toUpperCase().trim();
  return t.replace(/_/g, ' ');
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  selectedSupplierId,
  shortlistedIds = [],
  onToggleShortlist,
  onGenerateRFQ,
  onSelectForResponse,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [evidenceModalSupplier, setEvidenceModalSupplier] =
    useState<Supplier | null>(null);

  if (!suppliers.length) {
    return null;
  }

  const showActions = Boolean(
    onGenerateRFQ || onSelectForResponse || onToggleShortlist,
  );

  return (
    <>
      <div
        className={`rounded-lg border overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[980px] text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b uppercase tracking-wider text-[11px] font-semibold ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-stone-50 border-stone-200 text-stone-500'
                }`}
              >
                <th className="py-3 px-4 w-[22%]">Supplier & Type</th>
                <th className="py-3 px-3 w-[24%]">
                  Matched Requirement & Capability
                </th>
                <th className="py-3 px-3 w-[12%]">Location</th>
                <th className="py-3 px-3 w-[10%] text-right">Price</th>
                <th className="py-3 px-3 w-[10%] text-right">MOQ</th>
                <th className="py-3 px-3 w-[9%] text-right">Lead Time</th>
                <th className="py-3 px-3 w-[13%]">Source & Verification</th>
                {showActions && (
                  <th className="py-3 px-4 w-[140px] text-right">Actions</th>
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
                const isShortlisted = shortlistedIds.includes(s.supplier_id);
                const isLiveWeb =
                  !s.demo_supplier && s.discovery_source !== 'FALLBACK_CATALOG';
                const sourceLink = s.source_url || s.website || '';
                const sourceDomain =
                  s.source_domain ||
                  (sourceLink.startsWith('http')
                    ? (() => {
                        try {
                          return new URL(sourceLink).hostname.replace(
                            'www.',
                            '',
                          );
                        } catch {
                          return 'web';
                        }
                      })()
                    : 'web');
                const displayName = s.supplier_name || s.name;
                const supplierTypeLabel = formatSupplierTypeLabel(
                  s.supplier_type,
                );

                const moqText =
                  s.moq_display ||
                  (s.demo_supplier || s.moq_verified
                    ? `${s.minimum_order_quantity.toLocaleString('en-IN')} units`
                    : 'Not publicly listed');

                const priceText =
                  s.price_display ||
                  (s.demo_supplier || s.price_verified
                    ? `${formatINR(s.indicative_unit_price_inr)}/unit`
                    : 'Quote required');

                const leadTimeText =
                  s.lead_time_display ||
                  (s.demo_supplier || s.lead_time_verified
                    ? `${s.lead_time_days} days`
                    : 'Not publicly listed');

                const rawEvidence =
                  s.evidence ||
                  s.source_snippet ||
                  s.manufacturing_capabilities ||
                  '';
                const shortEvidence =
                  rawEvidence.length > 75
                    ? `${rawEvidence.slice(0, 75).trim()}...`
                    : rawEvidence;

                const capabilityText =
                  s.manufacturing_capabilities || s.materials || 'B2B supply';

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
                    {/* Column 1: Supplier & Type */}
                    <td className="py-3.5 px-4 align-top min-w-0 break-words">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#C84B31] truncate">
                        {supplierTypeLabel}
                      </div>
                      <div
                        className="font-semibold text-xs leading-snug mt-0.5 line-clamp-2 break-words"
                        title={displayName}
                      >
                        {displayName}
                      </div>

                      {s.certifications &&
                        s.certifications !== 'Not verified' && (
                          <div
                            className={`mt-1 text-[11px] truncate ${
                              isDark ? 'text-slate-400' : 'text-stone-500'
                            }`}
                            title={s.certifications}
                          >
                            Certs: {s.certifications}
                          </div>
                        )}

                      {isSelected && (
                        <div className="mt-1 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ SELECTED SUPPLIER
                        </div>
                      )}
                      {s.is_recovery_alternative && !isSelected && (
                        <div className="mt-1 font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                          ↻ RECOVERY ALTERNATIVE
                        </div>
                      )}
                    </td>

                    {/* Column 2: Matched Requirement & Capability + Compact Evidence */}
                    <td className="py-3.5 px-3 align-top min-w-0 break-words">
                      <div className="font-semibold text-xs text-[#C84B31] line-clamp-1">
                        {s.matched_requirement || s.materials || 'Raw Material'}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] line-clamp-1 ${
                          isDark ? 'text-slate-300' : 'text-stone-700'
                        }`}
                        title={capabilityText}
                      >
                        {capabilityText}
                      </div>
                      {shortEvidence && (
                        <div
                          className={`mt-1 text-[11px] leading-snug ${
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }`}
                          title={rawEvidence}
                        >
                          <span className="line-clamp-1">
                            Evidence: &ldquo;{shortEvidence}&rdquo;
                          </span>
                          <button
                            type="button"
                            onClick={() => setEvidenceModalSupplier(s)}
                            className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#C84B31] hover:underline"
                          >
                            <FileText className="h-2.5 w-2.5 shrink-0" />
                            [View Full Evidence]
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Column 3: Location */}
                    <td className="py-3.5 px-3 align-top min-w-0 break-words">
                      <div
                        className="text-xs font-medium line-clamp-2"
                        title={s.location || 'Not publicly listed'}
                      >
                        {s.location || 'Not publicly listed'}
                      </div>
                    </td>

                    {/* Column 4: Price */}
                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums min-w-0">
                      {s.demo_supplier || s.price_verified ? (
                        <span className="font-semibold">{priceText}</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          Quote required
                        </span>
                      )}
                    </td>

                    {/* Column 5: MOQ */}
                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums min-w-0">
                      {s.demo_supplier || s.moq_verified ? (
                        <span className="font-semibold">{moqText}</span>
                      ) : (
                        <span
                          className={
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }
                        >
                          Not publicly listed
                        </span>
                      )}
                    </td>

                    {/* Column 6: Lead Time */}
                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums min-w-0">
                      {s.demo_supplier || s.lead_time_verified ? (
                        <span className="font-semibold">{leadTimeText}</span>
                      ) : (
                        <span
                          className={
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }
                        >
                          Not publicly listed
                        </span>
                      )}
                    </td>

                    {/* Column 7: Source & Verification */}
                    <td className="py-3.5 px-3 align-top min-w-0 break-words">
                      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold">
                        <Globe className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span
                          className={
                            isLiveWeb
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {isLiveWeb ? 'Web-discovered' : 'Demo catalog'}
                        </span>
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] font-mono truncate ${
                          isDark ? 'text-slate-400' : 'text-stone-500'
                        }`}
                      >
                        {s.eligibility_status || 'Eligible'} · {sourceDomain}
                      </div>
                      {sourceLink && sourceLink.startsWith('http') && (
                        <div className="mt-1">
                          <a
                            href={sourceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#C84B31] hover:underline"
                            title={sourceLink}
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            View Source
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Column 8: Actions */}
                    {showActions && (
                      <td className="py-3.5 px-4 align-top text-right space-y-1.5">
                        {onToggleShortlist && (
                          <div>
                            <button
                              type="button"
                              onClick={() => onToggleShortlist(s)}
                              className={`inline-flex items-center justify-end gap-1 px-2 py-1 text-[11px] font-mono font-medium rounded border transition-colors whitespace-nowrap ${
                                isShortlisted
                                  ? 'border-[#C84B31] bg-[#C84B31]/10 text-[#C84B31]'
                                  : isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {isShortlisted ? (
                                <CheckSquare className="h-3 w-3" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                              {isShortlisted ? 'Shortlisted' : 'Compare'}
                            </button>
                          </div>
                        )}
                        {onGenerateRFQ && (
                          <div>
                            <button
                              type="button"
                              onClick={() => onGenerateRFQ(s.supplier_id)}
                              className={`px-2 py-1 text-[11px] font-mono font-medium rounded border transition-colors whitespace-nowrap ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                  : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                              }`}
                            >
                              Generate RFQ
                            </button>
                          </div>
                        )}
                        {onSelectForResponse && (
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectForResponse(s)}
                              className={`px-2 py-1 text-[11px] font-mono font-medium rounded border transition-colors whitespace-nowrap ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700'
                                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                              }`}
                            >
                              Log Quote
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

      {/* Expandable Full Evidence & Provenance Modal */}
      {evidenceModalSupplier && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            className={`w-full max-w-xl rounded-lg border shadow-xl overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div
              className={`px-5 py-3.5 border-b flex items-center justify-between ${
                isDark ? 'border-slate-800' : 'border-stone-200'
              }`}
            >
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#C84B31]">
                  {formatSupplierTypeLabel(evidenceModalSupplier.supplier_type)}{' '}
                  · Source Evidence
                </div>
                <h3 className="text-sm font-bold truncate mt-0.5">
                  {evidenceModalSupplier.supplier_name ||
                    evidenceModalSupplier.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceModalSupplier(null)}
                className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                <div>
                  <span className="text-stone-500 dark:text-slate-400">
                    Matched Requirement:
                  </span>
                  <div className="font-semibold text-[#C84B31] mt-0.5 break-words">
                    {evidenceModalSupplier.matched_requirement ||
                      evidenceModalSupplier.materials}
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-slate-400">
                    Location:
                  </span>
                  <div className="font-semibold mt-0.5 break-words">
                    {evidenceModalSupplier.location || 'Not publicly listed'}
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-slate-400">
                    Price / MOQ / Lead Time:
                  </span>
                  <div className="font-semibold mt-0.5">
                    {evidenceModalSupplier.price_display || 'Quote required'} ·{' '}
                    {evidenceModalSupplier.moq_display || 'Not publicly listed'}{' '}
                    ·{' '}
                    {evidenceModalSupplier.lead_time_display ||
                      'Not publicly listed'}
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-slate-400">
                    Certifications:
                  </span>
                  <div className="font-semibold mt-0.5 break-words">
                    {evidenceModalSupplier.certifications || 'Not verified'}
                  </div>
                </div>
              </div>

              {evidenceModalSupplier.search_query_used && (
                <div className="font-mono text-[11px]">
                  <span className="text-stone-500 dark:text-slate-400">
                    Search Query Executed:
                  </span>{' '}
                  <span className="font-semibold">
                    &ldquo;{evidenceModalSupplier.search_query_used}&rdquo;
                  </span>
                </div>
              )}

              <div>
                <div className="font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                  Extracted Web Evidence & Capability:
                </div>
                <div
                  className={`p-3 rounded border font-mono text-[11px] leading-relaxed break-words ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200'
                      : 'bg-stone-50 border-stone-200 text-stone-800'
                  }`}
                >
                  {evidenceModalSupplier.evidence ||
                    evidenceModalSupplier.source_snippet ||
                    evidenceModalSupplier.manufacturing_capabilities}
                </div>
              </div>

              {(evidenceModalSupplier.source_url ||
                evidenceModalSupplier.website) && (
                <div className="pt-1">
                  <a
                    href={
                      evidenceModalSupplier.source_url ||
                      evidenceModalSupplier.website
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#C84B31] hover:underline break-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {evidenceModalSupplier.source_title ||
                      evidenceModalSupplier.source_url ||
                      evidenceModalSupplier.website}
                  </a>
                </div>
              )}
            </div>

            <div
              className={`px-5 py-3 border-t flex justify-end ${
                isDark
                  ? 'border-slate-800 bg-slate-950/40'
                  : 'border-stone-200 bg-stone-50'
              }`}
            >
              <button
                type="button"
                onClick={() => setEvidenceModalSupplier(null)}
                className="px-3.5 py-1.5 text-xs font-medium rounded border border-stone-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
