import React from 'react';
import { Mission } from '../api/client';

interface MissionTimelineProps {
  mission: Mission;
  theme?: 'light' | 'dark';
}

const CORE_STATES = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUPPLIER_DISCOVERY', label: 'Supplier Discovery' },
  { key: 'RFQ_SENT', label: 'RFQ Dispatched' },
  { key: 'EVALUATING', label: 'Quote Evaluation' },
  { key: 'RISK_DETECTED', label: 'Risk / Recovery' },
  { key: 'WAITING_FOR_APPROVAL', label: 'Human Approval Gate' },
  { key: 'APPROVED', label: 'Approved & Executing' },
];

const STATE_ORDER: Record<string, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  SUPPLIER_DISCOVERY: 1,
  RFQ_GENERATED: 2,
  RFQ_SENT: 2,
  RESPONSES_RECEIVED: 3,
  EVALUATING: 3,
  RISK_DETECTED: 4,
  RECOVERY_IN_PROGRESS: 4,
  WAITING_FOR_APPROVAL: 5,
  APPROVED: 6,
  EXECUTING: 6,
  COMPLETED: 7,
  FAILED: -1,
  CANCELLED: -1,
};

export const MissionTimeline: React.FC<MissionTimelineProps> = ({
  mission,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const currentOrder = STATE_ORDER[mission.state] ?? 0;
  const hasRisk =
    mission.state === 'RISK_DETECTED' ||
    mission.state === 'RECOVERY_IN_PROGRESS' ||
    (mission.risks && mission.risks.length > 0);

  return (
    <div
      className={`rounded-md border p-4 ${
        isLight
          ? 'border-[#E7E5E4] bg-white'
          : 'border-[#292524] bg-[#1C1917]'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Mission State Machine
          </span>
          <span
            className={`rounded-[4px] border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${
              mission.state === 'WAITING_FOR_APPROVAL'
                ? 'border-[#D97706]/40 bg-[#D97706]/10 text-[#D97706]'
                : mission.state === 'RISK_DETECTED' ||
                    mission.state === 'RECOVERY_IN_PROGRESS'
                  ? 'border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626]'
                  : mission.state === 'APPROVED' ||
                      mission.state === 'COMPLETED'
                    ? 'border-[#15803D]/40 bg-[#15803D]/10 text-[#15803D]'
                    : 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#C84B31]'
            }`}
          >
            {mission.state}
          </span>
        </div>

        {mission.render_workflow && (
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[11px] ${
                isLight ? 'text-[#78716C]' : 'text-[#A8A29E]'
              }`}
            >
              Render Durable Step:
            </span>
            <span
              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                  : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
              }`}
            >
              {mission.render_workflow.current_step} (
              {mission.render_workflow.step_index + 1}/
              {mission.render_workflow.total_steps})
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {CORE_STATES.map((step, idx) => {
          const stepOrder = STATE_ORDER[step.key] ?? idx;
          const isCompleted = currentOrder > stepOrder;
          const isCurrent =
            currentOrder === stepOrder ||
            (step.key === 'RISK_DETECTED' &&
              (mission.state === 'RISK_DETECTED' ||
                mission.state === 'RECOVERY_IN_PROGRESS'));

          let boxClass = isLight
            ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#78716C]'
            : 'border-[#292524] bg-[#0C0A09] text-[#78716C]';

          if (isCurrent) {
            if (step.key === 'RISK_DETECTED') {
              boxClass =
                'border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626] font-semibold';
            } else if (step.key === 'WAITING_FOR_APPROVAL') {
              boxClass =
                'border-[#D97706] bg-[#D97706]/10 text-[#D97706] font-semibold';
            } else {
              boxClass =
                'border-[#C84B31] bg-[#C84B31]/10 text-[#C84B31] font-semibold';
            }
          } else if (isCompleted) {
            if (step.key === 'RISK_DETECTED' && !hasRisk) {
              boxClass = isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#A8A29E]'
                : 'border-[#292524] bg-[#0C0A09] text-[#57534E]';
            } else {
              boxClass = isLight
                ? 'border-[#15803D]/30 bg-[#15803D]/5 text-[#15803D]'
                : 'border-[#15803D]/40 bg-[#15803D]/10 text-[#22C55E]';
            }
          }

          return (
            <div
              key={step.key}
              className={`flex flex-col justify-between rounded-[4px] border p-2.5 transition-colors ${boxClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase">
                  0{idx + 1}
                </span>
                <span className="font-mono text-[10px]">
                  {isCurrent ? 'ACTIVE' : isCompleted ? 'DONE' : 'PENDING'}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-tight">{step.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
