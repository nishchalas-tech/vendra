import React from 'react';

interface LoadingStateProps {
  label?: string;
  message?: string;
  rows?: number;
  theme?: 'light' | 'dark';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  message,
  rows = 3,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const displayLabel = message || label || 'Loading operational data…';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-6 rounded-md border ${
        isDark
          ? 'bg-[#1C1917] border-[#292524]'
          : 'bg-white border-[#E7E5E4]'
      }`}
    >
      <p
        className={`text-xs font-mono font-medium mb-4 ${
          isDark ? 'text-[#A8A29E]' : 'text-[#57534E]'
        }`}
      >
        {displayLabel}
      </p>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`h-9 rounded-[4px] animate-pulse ${
              isDark ? 'bg-[#292524]' : 'bg-[#F3EFEA]'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
