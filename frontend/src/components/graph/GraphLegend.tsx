import React from 'react';

/* ═══════════════════════════════════════════════════
   GraphLegend — Explanatory key for nodes, tiers, and edges (Section 7A)
   ═══════════════════════════════════════════════════ */

export default function GraphLegend() {
  return (
    <div
      role="note"
      aria-label="Graph visual legend"
      className="flex flex-wrap items-center justify-between gap-3 text-[12px] pt-1 border-t border-[var(--border)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#f97316] shrink-0" aria-hidden="true" />
          <span className="text-[var(--text-secondary)] font-medium">Top 3 Authority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ec4899] shrink-0" aria-hidden="true" />
          <span className="text-[var(--text-secondary)] font-medium">Ranks 4–7</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#6b7280] shrink-0" aria-hidden="true" />
          <span className="text-[var(--text-secondary)] font-medium">Standard</span>
        </div>
      </div>

      <div className="text-[var(--text-muted)] text-[11px] font-mono">
        Scroll to zoom · Drag to pan · Click node to inspect
      </div>
    </div>
  );
}
