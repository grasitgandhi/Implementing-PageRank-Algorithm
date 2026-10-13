import { ExternalLink, ChevronRight, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import ScoreBar from './ScoreBar';

/* ═══════════════════════════════════════════════════
   ResultsTable — Displays search results from /api/search
   Renders real relevance, PageRank, final score, and cosine.
   ═══════════════════════════════════════════════════ */

const WEAK_MATCH_THRESHOLD = 0.10;

export default function ResultsTable() {
  const submittedQuery = useAppStore((s) => s.submittedQuery);
  const alpha = useAppStore((s) => s.alpha);
  const showBreakdown = useAppStore((s) => s.showBreakdown);
  const showCosine = useAppStore((s) => s.showCosine);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const results = useAppStore((s) => s.results);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);

  const bestCosine = results.length > 0 ? Math.max(...results.map((r) => r.raw_cosine || 0)) : 0;
  const isWeakMatch = results.length > 0 && bestCosine < WEAK_MATCH_THRESHOLD;

  return (
    <div
      id="results-table"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme
        flex flex-col gap-4
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
          Search Results{' '}
          <span className="text-[var(--text-muted)] font-normal">
            ({results.length} found)
          </span>
        </h3>
        {submittedQuery && (
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            Alpha: <span className="font-semibold gradient-text">{alpha.toFixed(2)}</span>
            {' · '}
            Query: <span className="font-semibold text-[var(--text-secondary)]">{submittedQuery}</span>
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      {showBreakdown && results.length > 0 && (
        <div className="flex items-center gap-4">
          <LegendDot color="#f97316" label="Relevance" />
          <LegendDot color="#ec4899" label="PageRank" />
          <LegendDot color="#eab308" label="Final Score" />
          {showCosine && <LegendDot color="#8b5cf6" label="Raw Cosine" />}
        </div>
      )}

      {/* ── Weak Match Warning ── */}
      {isWeakMatch && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] flex items-start gap-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Weak match warning: No crawled page matches this query strongly (best raw cosine: {bestCosine.toFixed(4)}).
            Relevance is scaled relative to the best matching page in the corpus.
          </span>
        </div>
      )}

      {/* ── Loading State ── */}
      {searchLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent-start)] mb-3" />
          <p className="text-[13px] text-[var(--text-muted)]">Computing TF-IDF relevance and PageRank fusion...</p>
        </div>
      )}

      {/* ── Not Crawled Error ── */}
      {!searchLoading && searchError === 'not_crawled' && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
            <AlertCircle size={22} className="text-amber-500" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
            No pages have been crawled yet
          </p>
          <p className="text-[12px] text-[var(--text-muted)] max-w-sm mb-4">
            Search requires both edges.txt and pages.db. Crawl pages from Wikipedia to build your index.
          </p>
          <button
            onClick={() => setTab('crawl')}
            className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-[12px] font-semibold shadow-glow cursor-pointer"
          >
            Open Crawl Tab
          </button>
        </div>
      )}

      {/* ── Other Search Errors ── */}
      {!searchLoading && searchError && searchError !== 'not_crawled' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[13px] text-center">
          {searchError}
        </div>
      )}

      {/* ── Empty Results ── */}
      {!searchLoading && !searchError && submittedQuery && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center mb-4 shadow-glow animate-glow-pulse">
            <span className="text-white text-xl">🔍</span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] font-medium max-w-sm mb-1">
            No page matched &apos;{submittedQuery}&apos;.
          </p>
          <p className="text-[12px] text-[var(--text-muted)] max-w-sm">
            Either none of those terms appear in the crawled corpus, or they appear in so many pages that their IDF weight is zero. Try more specific terms or crawl additional pages.
          </p>
        </div>
      )}

      {/* ── Initial Idle State ── */}
      {!searchLoading && !searchError && !submittedQuery && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center mb-4 shadow-glow">
            <span className="text-white text-xl">🔍</span>
          </div>
          <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
            {pipelineStatus?.crawled
              ? 'Enter a search query above and press Search or Enter.'
              : 'Crawl some pages from the Crawl tab first.'}
          </p>
        </div>
      )}

      {/* ── Results List ── */}
      {!searchLoading && results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((r, idx) => (
            <div
              key={r.page_id}
              id={`result-row-${r.page_id}`}
              onClick={() => setSelectedNode(r.page_id)}
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
                    {r.title}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--accent-start)] shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] truncate block">
                  {r.url}
                </span>

                {/* Score bars */}
                {showBreakdown && (
                  <div className="mt-2 flex flex-col gap-1">
                    <ScoreBar label="Relevance" value={r.relevance} color="orange" />
                    <ScoreBar label="PageRank" value={r.pagerank} color="pink" />
                    <ScoreBar label="Final" value={r.final} color="yellow" />
                    {showCosine && (
                      <ScoreBar label="Cosine" value={r.raw_cosine} color="purple" />
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
            </div>
          ))}
        </div>
      )}
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
