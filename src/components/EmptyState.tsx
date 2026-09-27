import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onActionClick?: () => void;
  onAction?: () => void;
  theme?: 'light' | 'dark';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  actionTo,
  onActionClick,
  onAction,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const handleClick = onAction || onActionClick;
  return (
    <div
      className={`p-8 rounded-md border text-left ${
        isDark
          ? 'bg-[#1C1917] border-[#292524] text-[#F5F5F4]'
          : 'bg-white border-[#E7E5E4] text-[#1C1917]'
      }`}
    >
      <h3
        className={`text-base font-semibold ${
          isDark ? 'text-[#F5F5F4]' : 'text-[#1C1917]'
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-1.5 text-sm max-w-xl leading-relaxed ${
          isDark ? 'text-[#A8A29E]' : 'text-[#57534E]'
        }`}
      >
        {description}
      </p>
      {actionLabel && actionTo && (
        <div className="mt-5">
          <Link
            to={actionTo}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C84B31] hover:bg-[#B03E26] rounded-md transition-colors whitespace-nowrap"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      {actionLabel && !actionTo && handleClick && (
        <div className="mt-5">
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C84B31] hover:bg-[#B03E26] rounded-md transition-colors whitespace-nowrap"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
