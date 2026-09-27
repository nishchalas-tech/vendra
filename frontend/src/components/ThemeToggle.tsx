import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
      }`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-3.5 h-3.5 text-stone-600" />
          <span>Dark theme</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Light theme</span>
        </>
      )}
    </button>
  );
};
