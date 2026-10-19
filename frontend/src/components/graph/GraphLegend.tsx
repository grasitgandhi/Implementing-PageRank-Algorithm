import React from 'react';
import { useAppStore } from '../../store/useAppStore';

/* ═══════════════════════════════════════════════════
   GraphLegend — Explanatory key for nodes, tiers, and edges (Section 7A)
   Theme-aware: Lavender in light mode, Midnight Sunset in dark mode
   ═══════════════════════════════════════════════════ */

export default function GraphLegend() {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div
      role="note"
      aria-label="Graph visual legend"
      className="flex flex-wrap items-center justify-between gap-3 text-[12px] pt-1 border-t border-[var(--border)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0 transition-colors"
            style={{ backgroundColor: isDark ? '#f97316' : '#9b8fe8' }}
            aria-hidden="true"
          />
          <span className="text-[var(--text-secondary)] font-medium">Top 3 Authority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0 transition-colors"
            style={{ backgroundColor: isDark ? '#ec4899' : '#c4b5fd' }}
            aria-hidden="true"
          />
          <span className="text-[var(--text-secondary)] font-medium">Ranks 4–7</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0 transition-colors"
            style={{ backgroundColor: isDark ? '#6b7280' : '#94a3b8' }}
            aria-hidden="true"
          />
          <span className="text-[var(--text-secondary)] font-medium">Standard</span>
        </div>
      </div>

      <div className="text-[var(--text-muted)] text-[11px] font-mono">
        Scroll to zoom · Drag to pan · Click node to inspect
      </div>
    </div>
  );
}
