import { useCallback } from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { mockPages } from '../mockData';
import { saveSearch } from '../api/storage';
import type { SearchResult } from '../types';

/* ═══════════════════════════════════════════════════
   SearchPanel — query input, alpha slider, display
   checkboxes, and search button
   ═══════════════════════════════════════════════════ */

/** Compute search results using the scoring formula:
 *  final_score = alpha * relevance + (1 - alpha) * pagerank
 */
export function computeResults(query: string, alpha: number): SearchResult[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase();
  const matched = mockPages.filter((p) =>
    p.title.toLowerCase().includes(q)
  );

  return matched
    .map((page) => ({
      page,
      combinedScore: alpha * page.relevance + (1 - alpha) * page.pagerank,
    }))
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 10);
}

export default function SearchPanel() {
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const alpha = useAppStore((s) => s.alpha);
  const setAlpha = useAppStore((s) => s.setAlpha);
  const showBreakdown = useAppStore((s) => s.showBreakdown);
  const setShowBreakdown = useAppStore((s) => s.setShowBreakdown);
  const showCosine = useAppStore((s) => s.showCosine);
  const setShowCosine = useAppStore((s) => s.setShowCosine);

  /** Called when the search button is clicked */
  const handleSearch = useCallback(() => {
    const results = computeResults(query, alpha);
    // Fire-and-forget save to the Flask bridge
    saveSearch({
      query,
      alpha,
      timestamp: new Date().toISOString(),
      results,
    });
  }, [query, alpha]);

  return (
    <div
      id="search-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-fade-in transition-theme
      "
    >
      {/* ── Search row ── */}
      <div className="flex items-center gap-3">
        {/* Input with icon */}
        <div className="flex-1 relative">
          <Search
            size={16}
            strokeWidth={2.2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="
              w-full pl-9 pr-4 py-2.5
              rounded-xl border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              transition-all duration-200
            "
          />
        </div>

        {/* Search button */}
        <button
          id="search-btn"
          onClick={handleSearch}
          className="
            px-5 py-2.5 rounded-xl
            bg-accent-gradient
            text-white text-[13px] font-semibold
            shadow-glow cursor-pointer
            hover:brightness-110 active:scale-[0.97]
            transition-all duration-200
            shrink-0
          "
        >
          Search
        </button>
      </div>

      {/* ── Alpha slider ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="alpha-slider"
            className="text-[12px] font-semibold text-[var(--text-secondary)]"
          >
            Alpha (relevance vs PageRank)
          </label>
          <span className="text-[12px] font-bold tabular-nums gradient-text">
            {alpha.toFixed(2)}
          </span>
        </div>
        <input
          id="alpha-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(e) => setAlpha(parseFloat(e.target.value))}
          className="alpha-range w-full"
        />
      </div>

      {/* ── Checkboxes ── */}
      <div className="mt-3 flex items-center gap-5">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            id="chk-breakdown"
            type="checkbox"
            checked={showBreakdown}
            onChange={(e) => setShowBreakdown(e.target.checked)}
            className="accent-[var(--accent-start)] w-3.5 h-3.5 rounded cursor-pointer"
          />
          <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            Show score breakdown
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            id="chk-cosine"
            type="checkbox"
            checked={showCosine}
            onChange={(e) => setShowCosine(e.target.checked)}
            className="accent-[var(--accent-start)] w-3.5 h-3.5 rounded cursor-pointer"
          />
          <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            Show raw cosine
          </span>
        </label>
      </div>
    </div>
  );
}
