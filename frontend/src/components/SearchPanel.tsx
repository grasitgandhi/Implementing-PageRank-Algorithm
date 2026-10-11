import { useCallback } from 'react';
import { Search, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   SearchPanel — query input, alpha slider, display
   checkboxes, and search execution
   ═══════════════════════════════════════════════════ */

export default function SearchPanel() {
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const alpha = useAppStore((s) => s.alpha);
  const setAlpha = useAppStore((s) => s.setAlpha);
  const showBreakdown = useAppStore((s) => s.showBreakdown);
  const setShowBreakdown = useAppStore((s) => s.setShowBreakdown);
  const showCosine = useAppStore((s) => s.showCosine);
  const setShowCosine = useAppStore((s) => s.setShowCosine);
  const setTab = useAppStore((s) => s.setTab);

  const status = useAppStore((s) => s.status);
  const isBackendOffline = useAppStore((s) => s.isBackendOffline);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const performSearch = useAppStore((s) => s.performSearch);

  const isCrawled = status?.crawled ?? false;

  const handleSearch = useCallback(() => {
    if (!query.trim() || !isCrawled) return;
    performSearch();
  }, [query, isCrawled, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // ── First-run gating: Not crawled yet ──
  if (!isCrawled && !isBackendOffline) {
    return (
      <div
        id="search-panel"
        className="
          rounded-2xl border border-[var(--border)]
          bg-[var(--card)] shadow-card
          p-6 animate-fade-in transition-theme
          flex flex-col items-center justify-center text-center
          py-10
        "
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-500">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
          Crawl some pages first
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] max-w-sm mb-5 leading-relaxed">
          The search index and PageRank authority scores require crawled web data.
          Run a crawl from seed pages to generate <code className="px-1.5 py-0.5 rounded bg-[var(--bg)] font-mono text-[11px]">edges.txt</code> and <code className="px-1.5 py-0.5 rounded bg-[var(--bg)] font-mono text-[11px]">pages.db</code>.
        </p>
        <button
          id="btn-goto-crawl"
          onClick={() => setTab('crawl')}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-accent-gradient text-white text-[13px] font-semibold
            shadow-glow cursor-pointer hover:brightness-110 active:scale-[0.98]
            transition-all
          "
        >
          <span>Go to Crawl Tab</span>
          <ArrowRight size={15} />
        </button>
      </div>
    );
  }

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
            disabled={!isCrawled || searchLoading}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search crawled pages..."
            className="
              w-full pl-9 pr-4 py-2.5
              rounded-xl border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              disabled:opacity-50 transition-all duration-200
            "
          />
        </div>

        {/* Search button */}
        <button
          id="search-btn"
          onClick={handleSearch}
          disabled={!query.trim() || !isCrawled || searchLoading}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-accent-gradient text-white text-[13px] font-semibold
            shadow-glow cursor-pointer
            hover:brightness-110 active:scale-[0.97]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            shrink-0
          "
        >
          {searchLoading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <span>Search</span>
          )}
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
        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
          <span>0.00 (Pure PageRank)</span>
          <span className="font-medium text-[var(--text-secondary)]">final = α·relevance + (1-α)·PageRank</span>
          <span>1.00 (Pure Relevance)</span>
        </div>
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
            Show cosine score
          </span>
        </label>
      </div>

      {/* Error message */}
      {searchError && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[12px]">
          {searchError}
        </div>
      )}
    </div>
  );
}
