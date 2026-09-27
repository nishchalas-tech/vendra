import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Cpu,
  ExternalLink,
  Globe,
  MessageSquare,
  Send,
  Sparkles,
  X,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import {
  api,
  ChatMessage,
  Mission,
  Supplier,
  SourcingRequirement,
} from '../api/client';
import { formatSupplierTypeLabel } from './SupplierTable';

interface VendraChatbotProps {
  theme: 'light' | 'dark';
  missionId?: string | null;
  onMissionUpdated?: (mission: Mission) => void;
  embedded?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const VendraChatbot: React.FC<VendraChatbotProps> = ({
  theme,
  missionId = null,
  onMissionUpdated,
  embedded = false,
  isOpen = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getChatHistory(missionId);
      setMessages(res.messages || []);
    } catch {
      // ignore initial history load error
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (embedded || isOpen) {
      loadHistory();
    }
  }, [missionId, embedded, isOpen]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendPrompt = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setInput('');

    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      user_id: 'me',
      mission_id: missionId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api.sendChatMessage({
        message: trimmed,
        mission_id: missionId,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        res.user_message,
        res.assistant_message,
      ]);
      if (res.mission && onMissionUpdated) {
        onMissionUpdated(res.mission);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process chat command.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendPrompt(input);
  };

  const presetPrompts = missionId
    ? [
        'Discover upstream raw-material & component suppliers for this mission',
        'Decompose this product into material & component requirements',
        'Generate & send RFQs to top discovered suppliers',
        'What is the mission status, risks, and pending approvals?',
      ]
    : [
        'Find raw-material & component suppliers for 1,000 Spiral Binded Notebooks in Bengaluru',
        'Decompose 1,000 insulated stainless steel water bottles into upstream materials & components',
        'Create a mission for 1,000 Spiral Binded Notebooks in Bengaluru under ₹250/unit within 30 days',
        'Find 70 GSM Maplitho Paper manufacturers in Bengaluru',
      ];

  const renderSupplierCards = (suppliers?: Supplier[]) => {
    if (!suppliers || suppliers.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Globe className="h-3 w-3 shrink-0" />
            Upstream B2B Suppliers ({suppliers.length})
          </div>
          <button
            type="button"
            onClick={() => {
              navigate('/suppliers');
              if (onClose) onClose();
            }}
            className="font-mono text-[10px] font-semibold text-[#C84B31] hover:underline"
          >
            Open in Supplier Hub →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {suppliers.slice(0, 4).map((s) => {
            const name = s.supplier_name || s.name;
            const link = s.source_url || s.website || '';
            const typeLabel = formatSupplierTypeLabel(s.supplier_type);
            const isLive =
              !s.demo_supplier && s.discovery_source !== 'FALLBACK_CATALOG';

            return (
              <div
                key={s.supplier_id}
                className={`rounded border p-2.5 text-[11px] min-w-0 break-words ${
                  isLight
                    ? 'border-[#E7E5E4] bg-white'
                    : 'border-[#292524] bg-[#1C1917]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-semibold uppercase text-[#C84B31]">
                    {typeLabel}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    {isLive ? 'Web-discovered' : 'Demo'} ·{' '}
                    {s.source_domain || 'web'}
                  </span>
                </div>

                <div className="font-bold text-xs mt-0.5 line-clamp-1">
                  {name}
                </div>

                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px]">
                  <div className="col-span-2 truncate">
                    <span className="text-[#78716C]">Matched Requirement: </span>
                    <strong className="text-[#C84B31]">
                      {s.matched_requirement || s.materials}
                    </strong>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-[#78716C]">Capability: </span>
                    <span>
                      {s.manufacturing_capabilities || s.materials || 'B2B supply'}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-[#78716C]">Location: </span>
                    <strong>{s.location || 'Not publicly listed'}</strong>
                  </div>
                  <div className="truncate">
                    <span className="text-[#78716C]">Price: </span>
                    <strong>{s.price_display || 'Quote required'}</strong>
                  </div>
                  <div className="truncate">
                    <span className="text-[#78716C]">MOQ: </span>
                    <strong>{s.moq_display || 'Not publicly listed'}</strong>
                  </div>
                  <div className="truncate">
                    <span className="text-[#78716C]">Lead Time: </span>
                    <strong>
                      {s.lead_time_display || 'Not publicly listed'}
                    </strong>
                  </div>
                </div>

                {link && link.startsWith('http') && (
                  <div className="mt-2 pt-1.5 border-t border-[#E7E5E4]/60 dark:border-[#292524] flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[#78716C] truncate">
                      {s.search_query_used
                        ? `Query: “${s.search_query_used}”`
                        : 'Verified B2B source'}
                    </span>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#C84B31] hover:underline shrink-0"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      View Source
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRequirementsList = (reqs?: SourcingRequirement[]) => {
    if (!reqs || reqs.length === 0) return null;
    return (
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-[#C84B31]">
          <Cpu className="h-3 w-3 shrink-0" />
          Decomposed Upstream Requirements ({reqs.length})
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {reqs.map((r, idx) => (
            <div
              key={idx}
              className={`rounded border px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                  : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
              }`}
            >
              <div className="min-w-0">
                <span className="font-mono text-[9px] uppercase text-[#78716C] block">
                  {String(r.type || 'raw_material').replace('_', ' ')}
                </span>
                <span className="font-semibold truncate block">{r.name}</span>
              </div>
              <button
                type="button"
                disabled={sending}
                onClick={() =>
                  sendPrompt(
                    `Find upstream suppliers for ${r.name} in ${r.location || 'Bengaluru'}`,
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[#C84B31]/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#C84B31] hover:bg-[#C84B31]/10 shrink-0"
              >
                <Search className="h-2.5 w-2.5" />
                Find Suppliers
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const chatBody = (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b px-4 py-3 ${
          isLight
            ? 'border-[#E7E5E4] bg-[#FAF8F5]'
            : 'border-[#292524] bg-[#0C0A09]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#C84B31] text-white">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold uppercase tracking-wider truncate">
                Vendra AI Procurement Copilot
              </span>
              <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                · Live Web Grounded
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#78716C] truncate">
              Raw-Material Decomposition · B2B Supplier Search · Mission Engine
            </p>
          </div>
        </div>
        {!embedded && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#78716C] hover:bg-stone-200/50 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Preset Quick Actions */}
      <div
        className={`border-b px-4 py-2.5 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mb-1.5 flex items-center gap-1 font-mono text-[10px] uppercase text-[#78716C]">
          <Sparkles className="h-3 w-3 text-[#C84B31]" />
          Quick Procurement Prompts:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presetPrompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={sending}
              onClick={() => sendPrompt(p)}
              className={`rounded-[4px] border px-2 py-1 text-left text-[11px] transition-colors line-clamp-1 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:border-[#C84B31] hover:text-[#1C1917]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E] hover:border-[#C84B31] hover:text-[#F5F5F4]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div
        className={`flex-1 overflow-y-auto p-4 space-y-3 min-w-0 ${
          embedded ? 'max-h-[440px] min-h-[280px]' : ''
        }`}
      >
        {loadingHistory && messages.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-[#78716C]">
            Loading Vendra AI session...
          </div>
        ) : messages.length === 0 ? (
          <div
            className={`rounded-md border p-4 text-xs leading-relaxed ${
              isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E]'
                : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
            }`}
          >
            <strong className="text-[#C84B31]">
              Vendra AI Copilot Ready.
            </strong>{' '}
            Ask me to decompose any product into upstream raw materials and
            components, perform a <strong>live B2B supplier search</strong>{' '}
            (e.g.,{' '}
            <em>
              &ldquo;Find raw-material &amp; component suppliers for 1,000
              Spiral Binded Notebooks in Bengaluru&rdquo;
            </em>
            ), create a sourcing mission, or generate RFQs.
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const meta = msg.metadata || {};
            return (
              <div
                key={msg.id}
                className={`flex flex-col min-w-0 ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[94%] rounded-md border p-3 text-xs leading-relaxed break-words min-w-0 ${
                    isUser
                      ? 'border-[#C84B31] bg-[#C84B31] text-white'
                      : isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                >
                  {!isUser && meta.action_taken && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 border-b pb-1.5 border-[#E7E5E4]/60 dark:border-[#292524]">
                      <span className="font-mono text-[10px] font-semibold text-[#C84B31]">
                        {meta.intent || 'BACKEND_ACTION'}
                      </span>
                      <span className="text-[#78716C]">·</span>
                      <span className="font-mono text-[10px] text-[#78716C] break-words">
                        {meta.action_taken}
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-line break-words">
                    {msg.content}
                  </div>

                  {!isUser && renderRequirementsList(meta.requirements)}
                  {!isUser && renderSupplierCards(meta.suppliers)}

                  {!isUser &&
                    meta.mission_id &&
                    meta.mission_id !== missionId && (
                      <div className="mt-2.5 pt-2 border-t border-[#E7E5E4]/60 dark:border-[#292524]">
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/missions/${meta.mission_id}`);
                            if (onClose) onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded bg-[#C84B31] px-2.5 py-1 font-mono text-[10px] font-semibold text-white hover:bg-[#B03E26]"
                        >
                          Open Mission Workspace ({meta.mission_id})
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex items-center gap-2 font-mono text-xs text-[#C84B31]">
            <Globe className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>
              Decomposing upstream requirements &amp; searching live B2B
              supplier sources...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600 break-words">
            {error}
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className={`flex items-center gap-2 border-t p-3 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask Vendra AI to find raw-material suppliers, decompose a product, or generate RFQs..."
          className={`flex-1 min-w-0 rounded-md border px-3 py-2 text-xs ${
            isLight
              ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
              : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
          }`}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26] disabled:opacity-50 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </button>
      </form>
    </div>
  );

  if (embedded) {
    return (
      <div
        className={`rounded-md border overflow-hidden ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        {chatBody}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div
        className={`flex h-full w-full max-w-xl flex-col border-l shadow-2xl ${
          isLight
            ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
            : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
        }`}
      >
        {chatBody}
      </div>
    </div>
  );
};

export const VendraChatbotTriggerButton: React.FC<{
  onClick: () => void;
  theme: 'light' | 'dark';
}> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-md bg-[#C84B31] px-4 py-2.5 font-mono text-xs font-semibold text-white shadow-lg transition-colors hover:bg-[#B03E26]"
    >
      <MessageSquare className="h-4 w-4" />
      <span>Vendra AI Chatbot</span>
    </button>
  );
};
