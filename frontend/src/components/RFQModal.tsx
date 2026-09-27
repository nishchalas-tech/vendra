import React from 'react';
import { X, Send } from 'lucide-react';
import { RFQ } from '../api/client';

interface RFQModalProps {
  rfq: RFQ | null;
  onClose: () => void;
  onSend?: (rfqId: string) => void;
  theme?: 'light' | 'dark';
}

export const RFQModal: React.FC<RFQModalProps> = ({
  rfq,
  onClose,
  onSend,
  theme = 'light',
}) => {
  if (!rfq) return null;
  const isDark = theme === 'dark';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rfq-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div
        className={`w-full max-w-2xl rounded-lg border shadow-xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-stone-200'
          }`}
        >
          <div>
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              RFQ · STATUS: {rfq.status}
            </div>
            <h3 id="rfq-modal-title" className="text-base font-semibold mt-0.5">
              {rfq.supplier_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close RFQ modal"
            className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
            <div>
              <span className="text-stone-500 dark:text-slate-400">
                Quantity / MOQ:
              </span>
              <p className="font-semibold mt-0.5">
                {rfq.quantity.toLocaleString('en-IN')} units
              </p>
            </div>
            <div>
              <span className="text-stone-500 dark:text-slate-400">
                Delivery Deadline:
              </span>
              <p className="font-semibold mt-0.5">
                &le; {rfq.delivery_deadline} days
              </p>
            </div>
            <div>
              <span className="text-stone-500 dark:text-slate-400">
                Certifications:
              </span>
              <p className="font-semibold mt-0.5">{rfq.certification}</p>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1.5">Formal RFQ Document</div>
            <pre
              className={`p-4 rounded border font-mono text-xs whitespace-pre-wrap leading-relaxed ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-stone-50 border-stone-200 text-stone-800'
              }`}
            >
              {rfq.rfq_body}
            </pre>
          </div>
        </div>

        <div
          className={`px-6 py-3.5 border-t flex items-center justify-end gap-3 ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-stone-200 bg-stone-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-stone-300 text-stone-700 hover:bg-white'
            }`}
          >
            Close
          </button>
          {onSend && (rfq.status === 'DRAFT' || rfq.status === 'READY') && (
            <button
              type="button"
              onClick={() => onSend(rfq.id)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch RFQ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
