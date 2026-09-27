import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  Factory,
  FileText,
  ShieldAlert,
  CheckSquare,
  ScrollText,
  Radar,
  Settings,
  LogOut,
  PlayCircle,
} from 'lucide-react';
import { User } from '../api/client';

interface SidebarProps {
  user: User;
  theme: 'light' | 'dark';
  onLogout: () => void;
  onLoadDemo: () => void;
  loadingDemo?: boolean;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/missions', label: 'Missions', icon: FolderKanban },
  { to: '/missions/new', label: 'New Mission', icon: PlusCircle },
  { to: '/suppliers', label: 'Suppliers', icon: Factory },
  { to: '/rfqs', label: 'RFQs', icon: FileText },
  { to: '/approvals', label: 'Human Approvals', icon: CheckSquare },
  { to: '/risks', label: 'Risk & Recovery', icon: ShieldAlert },
  { to: '/audit', label: 'Audit Ledger', icon: ScrollText },
  { to: '/opportunities', label: 'Opportunity Radar', icon: Radar },
  { to: '/settings', label: 'Settings & Profile', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  theme,
  onLogout,
  onLoadDemo,
  loadingDemo = false,
}) => {
  const isDark = theme === 'dark';

  return (
    <aside
      className={`w-64 shrink-0 border-r flex flex-col justify-between ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-200'
          : 'bg-white border-stone-200 text-stone-800'
      }`}
    >
      <div>
        {/* Brand Lockup */}
        <div
          className={`h-14 px-6 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-stone-200'
          }`}
        >
          <NavLink
            to="/dashboard"
            className={`text-base font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-stone-900'
            }`}
          >
            VENDRA
          </NavLink>
          <span
            className={`text-[11px] font-mono ${
              isDark ? 'text-slate-500' : 'text-stone-400'
            }`}
          >
            IN · ₹
          </span>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Main navigation" className="p-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/missions'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-emerald-950/60 text-emerald-400 border-l-2 border-emerald-500 font-semibold'
                      : 'bg-emerald-50/80 text-emerald-800 border-l-2 border-emerald-700 font-semibold'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Controls: Load Isolated Demo Scenario & Logout */}
      <div
        className={`p-3 border-t space-y-2 ${
          isDark ? 'border-slate-800' : 'border-stone-200'
        }`}
      >
        <button
          type="button"
          onClick={onLoadDemo}
          disabled={loadingDemo}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors text-left ${
            isDark
              ? 'bg-slate-800/70 border-slate-700 text-amber-300 hover:bg-slate-800'
              : 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/60'
          }`}
        >
          <PlayCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span className="truncate">
            {loadingDemo ? 'Loading Demo…' : 'Load Demo Scenario'}
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left ${
            isDark
              ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800/60'
              : 'text-stone-600 hover:text-red-700 hover:bg-stone-100/80'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
