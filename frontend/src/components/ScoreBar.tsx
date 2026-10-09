import { useMemo } from 'react';

/* ═══════════════════════════════════════════════════
   ScoreBar — Gradient progress bar for search scores
   Props:
     label  – display name ("Relevance", "PageRank", etc.)
     value  – number 0–1
     color  – palette key for the gradient
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
  pink:   'linear-gradient(90deg, #ec4899, #f472b6)',
  yellow: 'linear-gradient(90deg, #eab308, #facc15)',
  purple: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
};

export default function ScoreBar({ label, value, color }: ScoreBarProps) {
  const pct = useMemo(() => Math.min(Math.max(value, 0), 1) * 100, [value]);

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      {/* Label */}
      <span className="text-[11px] font-medium text-[var(--text-muted)] w-[70px] shrink-0 truncate">
        {label}
      </span>

      {/* Track */}
      <div className="flex-1 h-[6px] rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: gradients[color],
          }}
        />
      </div>

      {/* Numeric value */}
      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-secondary)] w-[36px] text-right shrink-0">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
