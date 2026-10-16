import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════
   Tooltip — Accessible hover/focus tooltip
   ═══════════════════════════════════════════════════ */

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-2.5 py-1 text-[11px] font-medium leading-tight
            text-[var(--text-primary)] bg-[var(--card)] border border-[var(--border)]
            rounded-lg shadow-card-hover whitespace-nowrap pointer-events-none
            animate-fade-in
            ${
              position === 'top'
                ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
                : 'top-full left-1/2 -translate-x-1/2 mt-2'
            }
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}
