import React from 'react';
import { AuditEventItem, formatTimeIST } from '../api/client';

interface AuditTimelineProps {
  events: AuditEventItem[];
  theme?: 'light' | 'dark';
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  events,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  if (!events.length) {
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
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-3">Actor</th>
              <th className="py-3 px-3">Event & Action</th>
              <th className="py-3 px-3">Reason & Evidence</th>
              <th className="py-3 px-3">Policy Decision</th>
              <th className="py-3 px-4 text-right">Result</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isDark ? 'divide-slate-800' : 'divide-stone-200'
            }`}
          >
            {events.map((ev) => {
              const policyColor =
                ev.policy_decision === 'HUMAN_APPROVAL'
                  ? 'text-amber-600 dark:text-amber-400'
                  : ev.policy_decision === 'BLOCKED'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400';

              return (
                <tr
                  key={ev.id}
                  className={
                    isDark ? 'hover:bg-slate-800/40' : 'hover:bg-stone-50/80'
                  }
                >
                  <td className="py-3 px-4 align-top font-mono tabular-nums whitespace-nowrap text-stone-500 dark:text-slate-400">
                    {formatTimeIST(ev.timestamp)}
                  </td>
                  <td className="py-3 px-3 align-top font-medium whitespace-nowrap">
                    {ev.actor}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <div className="font-mono text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                      {ev.event_type}
                    </div>
                    <div className="font-semibold mt-0.5">{ev.action}</div>
                  </td>
                  <td className="py-3 px-3 align-top max-w-md leading-relaxed">
                    {ev.reason}
                  </td>
                  <td
                    className={`py-3 px-3 align-top font-mono font-semibold whitespace-nowrap ${policyColor}`}
                  >
                    {ev.policy_decision}
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono font-semibold whitespace-nowrap">
                    {ev.result}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
