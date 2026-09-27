import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Mission, formatINR, formatDateShort } from '../api/client';

interface MissionCardProps {
  mission: Mission;
  theme?: 'light' | 'dark';
}

export function getMissionStateStyle(state: string, isDark: boolean): string {
  switch (state) {
    case 'COMPLETED':
      return isDark ? 'text-emerald-400' : 'text-emerald-700';
    case 'RISK_DETECTED':
    case 'FAILED':
      return isDark ? 'text-red-400' : 'text-red-700';
    case 'AWAITING_APPROVAL':
    case 'RECOVERY_IN_PROGRESS':
      return isDark ? 'text-amber-400' : 'text-amber-700';
    case 'DRAFT':
    case 'CANCELLED':
      return isDark ? 'text-slate-400' : 'text-stone-500';
    default:
      return isDark ? 'text-sky-400' : 'text-sky-700';
  }
}

export const MissionCard: React.FC<MissionCardProps> = ({
  mission,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const stateColor = getMissionStateStyle(mission.state, isDark);

  return (
    <div
      className={`p-5 rounded-lg border transition-colors ${
        isDark
          ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
          : 'bg-white border-stone-200 hover:border-stone-300'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`font-semibold ${stateColor}`}>
              ● {mission.state}
            </span>
            {mission.is_demo && (
              <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>
                · DEMO DATA
              </span>
            )}
            <span className={isDark ? 'text-slate-500' : 'text-stone-400'}>
              · {formatDateShort(mission.created_at)}
            </span>
          </div>

          <Link
            to={`/missions/${mission.id}`}
            className={`mt-1.5 block text-base font-semibold truncate hover:underline ${
              isDark ? 'text-white' : 'text-stone-900'
            }`}
          >
            {mission.mission_name}
          </Link>
          <p
            className={`mt-0.5 text-xs truncate ${
              isDark ? 'text-slate-400' : 'text-stone-600'
            }`}
          >
            {mission.product_name} · {mission.preferred_sourcing_location}
          </p>
        </div>

        <Link
          to={`/missions/${mission.id}`}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border shrink-0 whitespace-nowrap ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
          }`}
        >
          <span>Open</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Key Tabular Metrics */}
      <div
        className={`mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs ${
          isDark ? 'border-slate-800' : 'border-stone-100'
        }`}
      >
        <div>
          <span className={isDark ? 'text-slate-500' : 'text-stone-500'}>
            Quantity
          </span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {mission.quantity.toLocaleString('en-IN')} units
          </p>
        </div>
        <div>
          <span className={isDark ? 'text-slate-500' : 'text-stone-500'}>
            Target Unit Cost
          </span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {formatINR(mission.target_unit_cost)}/unit
          </p>
        </div>
        <div>
          <span className={isDark ? 'text-slate-500' : 'text-stone-500'}>
            Max Budget
          </span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {formatINR(mission.maximum_budget)}
          </p>
        </div>
        <div>
          <span className={isDark ? 'text-slate-500' : 'text-stone-500'}>
            Deadline
          </span>
          <p className="font-mono font-semibold mt-0.5 tabular-nums">
            {mission.delivery_deadline} days
          </p>
        </div>
      </div>
    </div>
  );
};
