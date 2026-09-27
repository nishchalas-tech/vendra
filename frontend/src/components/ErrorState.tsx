import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  theme?: 'light' | 'dark';
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Operational request failed',
  message,
  onRetry,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  return (
    <div
      role="alert"
      className={`p-5 rounded-md border ${
        isDark
          ? 'bg-red-950/30 border-red-900/60 text-red-200'
          : 'bg-red-50/70 border-red-200 text-red-900'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-[#1C1917] border-red-800 text-red-200 hover:bg-[#292524]'
                : 'bg-white border-red-300 text-red-800 hover:bg-red-50'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};
