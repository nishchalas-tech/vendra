import React from 'react';
import { Link } from 'react-router-dom';
import { Play, ArrowRight } from 'lucide-react';
import { User } from '../api/client';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  user: User | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLoadDemo?: () => void;
  loadingDemo?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  theme,
  onToggleTheme,
  onLoadDemo,
  loadingDemo,
}) => {
  const isDark = theme === 'dark';

  return (
    <header
      className={`h-16 px-6 lg:px-10 border-b flex items-center justify-between shrink-0 ${
        isDark
          ? 'bg-[#1C1917] border-[#292524] text-[#F5F5F4]'
          : 'bg-white border-[#E7E5E4] text-[#1C1917]'
      }`}
    >
      {/* Left Zone: Brand Identity */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#C84B31] font-mono text-sm font-bold text-white">
            V
          </div>
          <div>
            <span className="text-base font-bold tracking-tight">VENDRA</span>
            <span
              className={`ml-2 hidden font-mono text-[10px] uppercase tracking-wider sm:inline ${
                isDark ? 'text-[#A8A29E]' : 'text-[#78716C]'
              }`}
            >
              Sourcing Execution OS
            </span>
          </div>
        </Link>
      </div>

      {/* Right Zone: Actions & Auth */}
      <div className="flex items-center gap-3">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        {onLoadDemo && (
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loadingDemo}
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isDark
                ? 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#E05A3F] hover:bg-[#C84B31]/20'
                : 'border-[#C84B31]/40 bg-[#C84B31]/5 text-[#C84B31] hover:bg-[#C84B31]/10'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            {loadingDemo ? 'Loading Demo...' : 'Try Demo Scenario'}
          </button>
        )}

        {user ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26]"
          >
            <span>Dashboard ({user.full_name})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className={`rounded-md border px-3.5 py-1.5 text-xs font-semibold ${
                isDark
                  ? 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
                  : 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
              }`}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-[#C84B31] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26]"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
