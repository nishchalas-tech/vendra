import React, { useEffect, useState } from 'react';
import { X, Send, Edit3, Check } from 'lucide-react';
import { RFQ } from '../api/client';

interface RFQModalProps {
  rfq: RFQ | null;
  initialEditMode?: boolean;
  onClose: () => void;
  onSend?: (rfqId: string) => void;
  onSave?: (rfqId: string, payload: Partial<RFQ>) => Promise<void> | void;
  theme?: 'light' | 'dark';
}

export const RFQModal: React.FC<RFQModalProps> = ({
  rfq,
  initialEditMode = false,
  onClose,
  onSend,
  onSave,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [saving, setSaving] = useState(false);

  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState(1000);
  const [deadline, setDeadline] = useState(30);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [rfqBody, setRfqBody] = useState('');

  useEffect(() => {
    if (rfq) {
      setIsEditing(initialEditMode);
      setMaterial(rfq.material || '');
      setQuantity(rfq.quantity || 1000);
      setDeadline(rfq.delivery_deadline || 30);
      setPaymentTerms(rfq.payment_terms || '');
      setRfqBody(rfq.rfq_body || '');
    }
  }, [rfq, initialEditMode]);

  if (!rfq) return null;

  const handleSave = async () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(rfq.id, {
        material,
        quantity: Number(quantity) || rfq.quantity,
        delivery_deadline: Number(deadline) || rfq.delivery_deadline,
        payment_terms: paymentTerms,
        rfq_body: rfqBody,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rfq-modal-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
    >
      <div
        className={`w-full max-w-2xl h-full flex flex-col border-l shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-stone-200'
          }`}
        >
          <div className="min-w-0">
            <div className="text-xs font-mono text-[#C84B31] font-semibold">
              {rfq.id.toUpperCase()} · STATUS: {rfq.status}
            </div>
            <h3
              id="rfq-modal-title"
              className="text-base font-bold mt-0.5 truncate"
            >
              Supplier: {rfq.supplier_name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onSave && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold rounded border ${
                  isDark
                    ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close RFQ panel"
              className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                    Requirement / Material
                  </label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-stone-50 border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                    Production Quantity
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs font-mono ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-stone-50 border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                    Lead Time Cap (Days)
                  </label>
                  <input
                    type="number"
                    value={deadline}
                    onChange={(e) => setDeadline(Number(e.target.value))}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs font-mono ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-stone-50 border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                  Payment Terms Requested
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className={`w-full rounded border px-2.5 py-1.5 text-xs ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100'
                      : 'bg-stone-50 border-stone-300 text-stone-900'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-stone-500 dark:text-slate-400 mb-1">
                  Formal RFQ Body
                </label>
                <textarea
                  rows={14}
                  value={rfqBody}
                  onChange={(e) => setRfqBody(e.target.value)}
                  className={`w-full rounded border p-3 font-mono text-xs leading-relaxed ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100'
                      : 'bg-stone-50 border-stone-300 text-stone-900'
                  }`}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                <div>
                  <span className="text-stone-500 dark:text-slate-400">
                    Requirement:
                  </span>
                  <p className="font-semibold mt-0.5 break-words">
                    {rfq.material || rfq.product_requirements}
                  </p>
                </div>
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
                  <p className="font-semibold mt-0.5 break-words">
                    {rfq.certification || 'Standard B2B'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-stone-500 dark:text-slate-400">
                    Payment Terms:
                  </span>
                  <p className="font-semibold mt-0.5 break-words">
                    {rfq.payment_terms || 'Quote required'}
                  </p>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1.5">Formal RFQ Document</div>
                <pre
                  className={`p-4 rounded border font-mono text-xs whitespace-pre-wrap break-words leading-relaxed ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200'
                      : 'bg-stone-50 border-stone-200 text-stone-800'
                  }`}
                >
                  {rfq.rfq_body}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-end gap-3 ${
            isDark
              ? 'border-slate-800 bg-slate-950/40'
              : 'border-stone-200 bg-stone-50'
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
          {isEditing && onSave && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#C84B31] hover:bg-[#B03E26] rounded-md disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
          {onSend && (rfq.status === 'DRAFT' || rfq.status === 'READY') && (
            <button
              type="button"
              onClick={() => onSend(rfq.id)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send RFQ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
