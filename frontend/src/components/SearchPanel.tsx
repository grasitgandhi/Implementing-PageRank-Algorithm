import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Search, AlertCircle, Globe, History, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Button from './ui/Button';

/* ═══════════════════════════════════════════════════
   SearchPanel — Query input, alpha slider, display checkboxes,
   keyboard shortcuts (B4), and query suggestions (B8).
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
  const backendOffline = useAppStore((s) => s.backendOffline);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);
  const historyEntries = useAppStore((s) => s.historyEntries);

  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isCrawled = pipelineStatus?.crawled ?? false;

  // B4: Global keyboard shortcut '/' to focus search input, 'Esc' to clear/blur
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) {
          setQuery('');
        } else {
          inputRef.current?.blur();
        }
        setShowSuggestions(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [query, setQuery]);

  // B8: Query suggestions from history while typing (client-side)
  const suggestions = (() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || !showSuggestions) return [];
    const seen = new Set<string>();
    const matches: string[] = [];
    for (const item of historyEntries) {
      const q = item.query.trim();
      const lower = q.toLowerCase();
      if (lower.includes(trimmed) && lower !== trimmed && !seen.has(lower)) {
        seen.add(lower);
        matches.push(q);
        if (matches.length >= 5) break;
      }
    }
    return matches;
  })();

  const handleSearch = () => {
    setShowSuggestions(false);
    if (!isCrawled || searchLoading) return;
    performSearch(query, alpha, true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectSuggestion = (suggested: string) => {
    setQuery(suggested);
    setShowSuggestions(false);
    performSearch(suggested, alpha, true);
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
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[12px] flex items-center gap-2.5"
        >
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span>
            Backend server is offline (http://localhost:5000). Start with:{' '}
            <code className="font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)]">
              python server.py
            </code>
          </span>
        </div>
      )}

      {/* ── First-Run Gating: Not Crawled Notice ── */}
      {!isCrawled && !backendOffline && (
        <div
          role="status"
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Globe size={20} className="shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                No crawled data yet
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                Crawl Wikipedia pages in the Crawl panel first to build the index and link graph.
              </p>
            </div>
          </div>
          <button
            id="gate-crawl-btn"
            onClick={() => setTab('crawl')}
            className="
              px-4 py-2 rounded-xl bg-accent-gradient text-white
              text-[12px] font-semibold shadow-glow hover:brightness-110
              transition-all shrink-0 cursor-pointer
            "
          >
            Go to Crawl
          </button>
        </div>
      )}

      {/* ── Search Input Row with Suggestions (B4, B8) ── */}
      <div className="relative">
        <div className="flex items-center gap-3">
          {/* Input with icon & keyboard shortcut badge */}
          <div className="flex-1 relative">
            <Search
              size={16}
              strokeWidth={2.2}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              ref={inputRef}
              id="search-input"
              type="text"
              value={query}
              disabled={!isCrawled || searchLoading}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isCrawled
                  ? 'Search crawled pages (e.g. pagerank algorithm)...'
                  : 'Crawl pages first to enable search...'
              }
              aria-label="Search query"
              className="
                w-full pl-10 pr-16 py-2.5
                rounded-xl border border-[var(--border)]
                bg-[var(--bg)] text-[var(--text-primary)]
                text-[13px] placeholder:text-[var(--text-muted)]
                focus:outline-none focus:border-[var(--accent-start)]
                focus:ring-2 focus:ring-[var(--accent-glow)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            />

            {/* Clear / Shortcut hint chip (B4) */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear query"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--text-muted)] bg-[var(--card)] border border-[var(--border)] rounded"
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Search button */}
          <Button
            id="search-btn"
            type="button"
            onClick={handleSearch}
            disabled={!isCrawled || searchLoading}
            loading={searchLoading}
            variant="primary"
          >
            Search
          </Button>
        </div>

        {/* B8: Autocomplete / History suggestions dropdown */}
        {suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Search suggestions"
            className="
              absolute top-full left-0 right-0 z-30 mt-1.5
              rounded-xl border border-[var(--border)]
              bg-[var(--card)] shadow-card-hover
              p-1.5 flex flex-col gap-0.5 animate-fade-in
            "
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="
                  flex items-center gap-2 px-3 py-2 rounded-lg
                  text-left text-[12px] text-[var(--text-secondary)]
                  hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]
                  cursor-pointer transition-colors
                "
              >
                <History
                  size={13}
                  className="text-[var(--text-muted)] shrink-0"
                  aria-hidden="true"
                />
                <span className="font-medium truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Alpha slider with Accessible aria-valuetext (Section 7C) ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="alpha-slider"
            className="text-[12px] font-semibold text-[var(--text-secondary)]"
          >
            Alpha blend (relevance vs PageRank)
          </label>
          <span className="text-[12px] font-bold font-mono tabular-nums gradient-text">
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
          aria-label="Alpha blend factor between relevance and PageRank"
          aria-valuetext={`${alpha.toFixed(2)}: ${(alpha * 100).toFixed(0)}% relevance, ${((1 - alpha) * 100).toFixed(0)}% PageRank authority`}
          className="alpha-range w-full disabled:opacity-50"
        />
        <div className="flex justify-between text-[12px] text-[var(--text-muted)] mt-1.5 font-medium">
          <span>0.00 (100% PageRank Authority)</span>
          <span>0.50 (Balanced Fusion)</span>
          <span>1.00 (100% TF-IDF Relevance)</span>
        </div>
      </div>

      {/* ── Checkboxes ── */}
      <div className="flex items-center gap-6 pt-1">
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
