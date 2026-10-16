import { useMemo } from 'react';

/* ═══════════════════════════════════════════════════
   ScoreBar — Gradient progress bar for search scores
   Props:
     label  – display name ("Relevance", "PageRank", etc.)
     value  – number 0–1
     color  – palette key for the gradient
   WCAG: 12px text minimum, tabular numeric values,
   accessible ARIA role and label.
   ═══════════════════════════════════════════════════ */

type ScoreBarColor = 'orange' | 'pink' | 'yellow' | 'purple';

interface ScoreBarProps {
  label: string;
  value: number;
  color: ScoreBarColor;
}

/** Gradient palettes keyed by color prop */
const gradients: Record<ScoreBarColor, string> = {
  orange: 'linear-gradient(90deg, #f97316, #fb923c)',
  pink: 'linear-gradient(90deg, #ec4899, #f472b6)',
  yellow: 'linear-gradient(90deg, #eab308, #facc15)',
  purple: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
};

export default function ScoreBar({ label, value, color }: ScoreBarProps) {
  const safeVal = isNaN(value) ? 0 : value;
  const pct = useMemo(() => Math.min(Math.max(safeVal, 0), 1) * 100, [safeVal]);

  return (
    <div
      role="progressbar"
      aria-label={`${label}: ${safeVal.toFixed(3)}`}
      aria-valuenow={safeVal}
      aria-valuemin={0}
      aria-valuemax={1}
      className="flex items-center gap-2 w-full min-w-0"
    >
      {/* Label */}
      <span className="text-[12px] font-medium text-[var(--text-muted)] w-[75px] shrink-0 truncate">
        {label}
      </span>

      {/* Track */}
      <div className="flex-1 h-[6px] rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: gradients[color],
          }}
        />
      </div>

      {/* Numeric value: font-mono tabular-nums */}
      <span className="text-[12px] font-semibold font-mono tabular-nums text-[var(--text-secondary)] w-[40px] text-right shrink-0">
        {safeVal.toFixed(2)}
      </span>
    </div>
  );
}
