import { useMemo } from 'react';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeResults } from './SearchPanel';
import ScoreBar from './ScoreBar';

/* ═══════════════════════════════════════════════════
   ResultsTable — Top-10 search results with score bars
   ═══════════════════════════════════════════════════ */

export default function ResultsTable() {
  const query = useAppStore((s) => s.query);
  const alpha = useAppStore((s) => s.alpha);
  const showBreakdown = useAppStore((s) => s.showBreakdown);
  const showCosine = useAppStore((s) => s.showCosine);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);

  const results = useMemo(
    () => computeResults(query, alpha),
    [query, alpha],
  );

  return (
    <div
      id="results-table"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme
        flex flex-col
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
          Search Results{' '}
          <span className="text-[var(--text-muted)] font-normal">
            (Top 10)
          </span>
        </h3>
        {query && (
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            Alpha: <span className="font-semibold gradient-text">{alpha.toFixed(2)}</span>
            {' · '}
            Query: <span className="font-semibold text-[var(--text-secondary)]">{query}</span>
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      {showBreakdown && results.length > 0 && (
        <div className="flex items-center gap-4 mb-3">
          <LegendDot color="#f97316" label="Relevance" />
          <LegendDot color="#ec4899" label="PageRank" />
          <LegendDot color="#eab308" label="Final Score" />
          {showCosine && <LegendDot color="#8b5cf6" label="Cosine" />}
        </div>
      )}

      {/* ── Empty state ── */}
      {results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center mb-4 shadow-glow animate-glow-pulse">
            <span className="text-white text-xl">🔍</span>
          </div>
          <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
            {query
              ? 'No pages match your query. Try a different search term.'
              : 'Enter a search query above to see ranked results.'}
          </p>
        </div>
      )}

      {/* ── Result rows ── */}
      <div className="flex flex-col gap-1.5">
        {results.map((r, idx) => (
          <button
            key={r.page.id}
            id={`result-row-${r.page.id}`}
            onClick={() => setSelectedNode(r.page.id)}
            className="
              flex items-start gap-3 p-3 rounded-xl
              border border-transparent
              hover:bg-[var(--card-hover)] hover:border-[var(--border)]
              cursor-pointer transition-all duration-200
              text-left w-full group
            "
          >
            {/* Rank */}
            <span className="
              text-[12px] font-bold tabular-nums
              text-[var(--text-muted)] mt-0.5
              w-5 shrink-0 text-center
            ">
              {idx + 1}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[13px] font-semibold gradient-text truncate">
                  {r.page.title}
                </span>
                <ExternalLink
                  size={12}
                  className="text-[var(--accent-start)] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] truncate block">
                {r.page.url}
              </span>

              {/* Score bars */}
              {showBreakdown && (
                <div className="mt-2 flex flex-col gap-1">
                  <ScoreBar label="Relevance" value={r.page.relevance} color="orange" />
                  <ScoreBar label="PageRank" value={r.page.pagerank} color="pink" />
                  <ScoreBar label="Final" value={r.combinedScore} color="yellow" />
                  {showCosine && (
                    <ScoreBar label="Cosine" value={r.page.cosine} color="purple" />
                  )}
                </div>
              )}
            </div>

            {/* Chevron */}
            <ChevronRight
              size={16}
              className="
                text-[var(--text-muted)] mt-0.5 shrink-0
                opacity-40 group-hover:opacity-100
                group-hover:translate-x-0.5
                transition-all duration-200
              "
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Legend dot helper ── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
