import { KeyboardEvent } from 'react';
import { Search, Loader2, AlertCircle, Globe, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   SearchPanel — Query input, alpha slider, display
   checkboxes, and search button.
   Wires directly to GET /api/search (no keystroke search).
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

  const performSearch = useAppStore((s) => s.performSearch);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);

  const isCrawled = pipelineStatus?.crawled ?? false;

  const handleSearch = () => {
    if (!isCrawled || searchLoading) return;
    performSearch(query, alpha);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div
      id="search-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-fade-in transition-theme flex flex-col gap-4
      "
    >
      {/* ── Offline Banner ── */}
      {backendOffline && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[12px] flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>Backend server is offline (http://localhost:5000). Start with: <code className="font-mono">python server.py</code></span>
        </div>
      )}

      {/* ── First-Run Gating: Not Crawled Notice ── */}
      {!isCrawled && !backendOffline && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Globe size={18} className="shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                No crawled data yet
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Crawl some web pages first to build the index and link graph.
              </p>
            </div>
          </div>
          <button
            id="gate-crawl-btn"
            onClick={() => setTab('crawl')}
            className="
              px-3.5 py-1.5 rounded-lg bg-accent-gradient text-white
              text-[12px] font-semibold shadow-glow hover:brightness-110
              transition-all shrink-0 cursor-pointer
            "
          >
            Go to Crawl
          </button>
        </div>
      )}

      {/* ── Search Input Row ── */}
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
            disabled={!isCrawled || searchLoading}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCrawled ? 'Search crawled pages (e.g. pagerank algorithm)...' : 'Crawl pages first to enable search...'}
            className="
              w-full pl-9 pr-4 py-2.5
              rounded-xl border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          />
        </div>

        {/* Search button */}
        <button
          id="search-btn"
          onClick={handleSearch}
          disabled={!isCrawled || searchLoading}
          className="
            px-5 py-2.5 rounded-xl
            bg-accent-gradient
            text-white text-[13px] font-semibold
            shadow-glow cursor-pointer
            hover:brightness-110 active:scale-[0.97]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            shrink-0 flex items-center gap-2
          "
        >
          {searchLoading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* ── Alpha slider ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="alpha-slider"
            className="text-[12px] font-semibold text-[var(--text-secondary)]"
          >
            Alpha blend (relevance vs PageRank)
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
          disabled={!isCrawled}
          onChange={(e) => setAlpha(parseFloat(e.target.value))}
          className="alpha-range w-full disabled:opacity-50"
        />
        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
          <span>0.00 (100% PageRank Authority)</span>
          <span>0.50 (Balanced Fusion)</span>
          <span>1.00 (100% TF-IDF Relevance)</span>
        </div>
      </div>

      {/* ── Checkboxes ── */}
      <div className="flex items-center gap-5 pt-1">
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
