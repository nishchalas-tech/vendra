import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Factory,
  FileSpreadsheet,
  AlertTriangle,
  ScrollText,
  Play,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { User } from '../api/client';

interface LandingProps {
  user: User | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLoadDemo: () => void;
  loadingDemo?: boolean;
}

export const Landing: React.FC<LandingProps> = ({
  user,
  theme,
  onToggleTheme,
  onLoadDemo,
  loadingDemo,
}) => {
  const isLight = theme === 'light';

  return (
    <div
      className={`min-h-screen ${
        isLight ? 'bg-[#FAF8F5] text-[#1C1917]' : 'bg-[#0C0A09] text-[#F5F5F4]'
      }`}
    >
      <Navbar
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLoadDemo={onLoadDemo}
        loadingDemo={loadingDemo}
      />

      {/* Hero Section */}
      <section className="mx-auto max-w-[1440px] px-6 pt-12 pb-16 lg:px-10 lg:pt-16">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-[4px] border border-[#C84B31]/30 bg-[#C84B31]/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-none bg-[#C84B31]" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
                India D2C Supply Chain & Sourcing Execution OS
              </span>
            </div>

            <h1
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:leading-[1.08]"
              style={{ letterSpacing: '-0.03em' }}
            >
              Autonomous sourcing, deterministic guardrails, and verified human approval gates.
            </h1>

            <p
              className={`mt-5 max-w-[62ch] text-base leading-relaxed ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Vendra helps founders and MSME operators in India turn product specifications into structured supplier shortlists, commercial RFQs, landed INR cost sheets, autonomous delay recovery, and auditable purchase decisions.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-[#C84B31] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#B03E26]"
                >
                  Open Mission Control
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 rounded-md bg-[#C84B31] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#B03E26]"
                  >
                    Create Founder Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className={`inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-semibold transition-colors ${
                      isLight
                        ? 'border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F3EFEA]'
                        : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4] hover:bg-[#292524]'
                    }`}
                  >
                    Sign In
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={onLoadDemo}
                disabled={loadingDemo}
                className={`inline-flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${
                  isLight
                    ? 'border-[#C84B31]/40 bg-[#C84B31]/5 text-[#C84B31] hover:bg-[#C84B31]/10'
                    : 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#E05A3F] hover:bg-[#C84B31]/20'
                }`}
              >
                <Play className="h-4 w-4" />
                {loadingDemo
                  ? 'Loading Demo Scenario...'
                  : 'Try Demo Scenario (Bamboo Lunch Box)'}
              </button>
            </div>

            <div
              className={`mt-8 grid grid-cols-3 gap-4 border-t pt-6 ${
                isLight ? 'border-[#E7E5E4]' : 'border-[#292524]'
              }`}
            >
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                  Zero Fabrication
                </p>
                <p
                  className={`mt-1 text-xs ${
                    isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                  }`}
                >
                  Every quote and supplier attribute is tagged with explicit source provenance.
                </p>
              </div>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                  Deterministic Policy
                </p>
                <p
                  className={`mt-1 text-xs ${
                    isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                  }`}
                >
                  Hard constraints on INR budget, MOQ, lead time, and food-grade certifications.
                </p>
              </div>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                  Human-in-the-Loop
                </p>
                <p
                  className={`mt-1 text-xs ${
                    isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                  }`}
                >
                  AI prepares comparisons and recovery plans; founders approve all commitments.
                </p>
              </div>
            </div>
          </div>

          {/* Live Operational Preview Panel */}
          <div className="lg:col-span-6">
            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-white shadow-xs'
                  : 'border-[#292524] bg-[#1C1917]'
              }`}
            >
              <div
                className={`flex items-center justify-between border-b pb-3 ${
                  isLight ? 'border-[#E7E5E4]' : 'border-[#292524]'
                }`}
              >
                <div>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
                    Sample Mission Execution Ledger
                  </span>
                  <h2 className="text-base font-bold">
                    Bamboo Lunch Box Production — 500 Units (Bengaluru)
                  </h2>
                </div>
                <span className="rounded-[4px] border border-[#D97706]/40 bg-[#D97706]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#D97706]">
                  WAITING_FOR_APPROVAL
                </span>
              </div>

              {/* Constraint & Cost Snapshot */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div
                  className={`rounded-[4px] border p-3 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-[#78716C]">
                    Max Budget
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                    ₹75,000
                  </p>
                </div>
                <div
                  className={`rounded-[4px] border p-3 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-[#78716C]">
                    Recommended Quote
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#15803D]">
                    ₹64,000
                  </p>
                </div>
                <div
                  className={`rounded-[4px] border p-3 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-[#78716C]">
                    Landed Unit Cost
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                    ₹128 / unit
                  </p>
                </div>
                <div
                  className={`rounded-[4px] border p-3 ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                      : 'border-[#292524] bg-[#0C0A09]'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-[#78716C]">
                    Lead Time
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                    10 days (≤14d)
                  </p>
                </div>
              </div>

              {/* Risk Detection & Autonomous Recovery Preview */}
              <div className="mt-4 rounded-[4px] border border-[#DC2626]/30 bg-[#DC2626]/5 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase text-[#DC2626]">
                    Failure Recovery Triggered: Lead Time Violation
                  </span>
                  <span className="font-mono text-[11px] text-[#DC2626]">
                    21 days &gt; 14 days deadline
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs ${
                    isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                  }`}
                >
                  Namma Bamboo Works (Peenya, Bengaluru) revised delivery lead time to 21 days. Vendra automatically re-evaluated backup suppliers and prepared an approval request for Kaveri Natural Products (Mysuru, 12 days, ₹132/unit) and GreenCraft Packaging (Bengaluru, 10 days, ₹128/unit).
                </p>
              </div>

              {/* Supplier Comparison Preview */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className={`border-b font-mono text-[10px] uppercase ${
                        isLight
                          ? 'border-[#E7E5E4] text-[#78716C]'
                          : 'border-[#292524] text-[#A8A29E]'
                      }`}
                    >
                      <th className="pb-2">Supplier</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2 text-right">MOQ</th>
                      <th className="pb-2 text-right">Total Cost</th>
                      <th className="pb-2 text-right">Lead Time</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]/50 font-mono">
                    <tr>
                      <td className="py-2 font-sans font-semibold">
                        GreenCraft Packaging
                      </td>
                      <td className="py-2 font-sans">Peenya, Bengaluru</td>
                      <td className="py-2 text-right tabular-nums">300</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-[#15803D]">
                        ₹64,000
                      </td>
                      <td className="py-2 text-right tabular-nums">10d</td>
                      <td className="py-2">
                        <span className="rounded-[4px] border border-[#15803D]/40 bg-[#15803D]/10 px-1.5 py-0.5 text-[10px] text-[#15803D]">
                          ELIGIBLE
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-sans font-semibold">
                        Kaveri Natural Products
                      </td>
                      <td className="py-2 font-sans">Hebbal, Mysuru</td>
                      <td className="py-2 text-right tabular-nums">400</td>
                      <td className="py-2 text-right tabular-nums">₹66,000</td>
                      <td className="py-2 text-right tabular-nums">12d</td>
                      <td className="py-2">
                        <span className="rounded-[4px] border border-[#0284C7]/40 bg-[#0284C7]/10 px-1.5 py-0.5 text-[10px] text-[#0284C7]">
                          BACKUP READY
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-sans font-semibold">
                        Namma Bamboo Works
                      </td>
                      <td className="py-2 font-sans">Peenya, Bengaluru</td>
                      <td className="py-2 text-right tabular-nums">500</td>
                      <td className="py-2 text-right tabular-nums">₹62,500</td>
                      <td className="py-2 text-right tabular-nums text-[#DC2626]">
                        21d
                      </td>
                      <td className="py-2">
                        <span className="rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 px-1.5 py-0.5 text-[10px] text-[#DC2626]">
                          DELAY RISK
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Capabilities Grid */}
      <section
        className={`border-t py-14 ${
          isLight ? 'border-[#E7E5E4] bg-white' : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="mb-8">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
              End-to-End Execution Pipeline
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Built for operational clarity, not generic chat responses
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <Factory className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                1. Multi-Factor Supplier Discovery
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Evaluates Indian manufacturing clusters across product capability, materials, MOQ compatibility, unit cost, lead time, and certifications without opaque arbitrary scores.
              </p>
            </div>

            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <FileSpreadsheet className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                2. Commercial RFQ & Landed INR Costing
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Generates structured RFQs and parses unstructured supplier quotes into deterministic landed cost breakdowns (manufacturing + packaging + shipping vs. max budget).
              </p>
            </div>

            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <AlertTriangle className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                3. Autonomous Delay & Budget Recovery
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Detects constraint breaches immediately when a supplier revises lead time or pricing, ranks compliant backup suppliers, and prepares a recovery approval package.
              </p>
            </div>

            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <ShieldCheck className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                4. Deterministic Policy Engine
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Code-enforced policy guardrails prevent AI from ever auto-committing funds, approving supplier selection, or bypassing certification requirements.
              </p>
            </div>

            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <CheckCircle2 className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                5. Explicit Human Approval Gate
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Founders inspect full commercial terms, evidence provenance, and AI rationale before approving, rejecting, or requesting deeper comparison.
              </p>
            </div>

            <div
              className={`rounded-md border p-5 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <ScrollText className="h-5 w-5 text-[#C84B31]" />
              <h3 className="mt-3 text-base font-bold">
                6. Immutable Audit Ledger
              </h3>
              <p
                className={`mt-1.5 text-sm ${
                  isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
                }`}
              >
                Every discovery run, RFQ dispatch, quote evaluation, risk alert, and founder decision is logged with timestamps, actors, inputs, outputs, and policy decisions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
