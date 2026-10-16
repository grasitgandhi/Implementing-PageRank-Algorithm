import { useState } from 'react';
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  Download,
  FileJson,
  FileSpreadsheet,
  Calculator,
  X,
  HelpCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import ScoreBar from './ScoreBar';
import AsyncState from './AsyncState';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { explainRankScore } from '../utils/ranking';
import { exportResultsAsCSV, exportResultsAsJSON } from '../utils/format';
import type { SearchResult } from '../types';

/* ═══════════════════════════════════════════════════
   ResultsTable — Displays search results from /api/search
   Features:
   - "Why this rank?" formula arithmetic popover (B3)
   - Inline row detail expansion via fetchPageDetail (B6)
   - Client-side CSV & JSON export (B7)
   - 5 AsyncState integration with skeleton loading (Section 7C)
   - Preserves WEAK_MATCH_THRESHOLD warning and all element IDs.
   ═══════════════════════════════════════════════════ */

/** Minimum best raw_cosine before displaying weak match advisory */
const WEAK_MATCH_THRESHOLD = 0.1;

export default function ResultsTable() {
  const submittedQuery = useAppStore((s) => s.submittedQuery);
  const alpha = useAppStore((s) => s.alpha);
  const showBreakdown = useAppStore((s) => s.showBreakdown);
  const showCosine = useAppStore((s) => s.showCosine);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const results = useAppStore((s) => s.results);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);
  const addToast = useAppStore((s) => s.addToast);
  const selectedPageDetail = useAppStore((s) => s.selectedPageDetail);
  const selectedPageLoading = useAppStore((s) => s.selectedPageLoading);

  // B6: Track which row is expanded inline
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // B3: Track which row's "Why this rank?" popover is currently active
  const [activeRankExplain, setActiveRankExplain] = useState<SearchResult | null>(null);

  const bestCosine = results.length > 0 ? Math.max(...results.map((r) => r.raw_cosine || 0)) : 0;
  const isWeakMatch = results.length > 0 && bestCosine < WEAK_MATCH_THRESHOLD;

  const handleToggleExpand = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (expandedRowId === pageId) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(pageId);
      setSelectedNode(pageId);
    }
  };

  const handleExportCSV = () => {
    if (!results.length) return;
    exportResultsAsCSV(results, submittedQuery);
    addToast('success', `Exported ${results.length} results to CSV`);
  };

  const handleExportJSON = () => {
    if (!results.length) return;
    exportResultsAsJSON(results, submittedQuery);
    addToast('success', `Exported ${results.length} results to JSON`);
  };

  return (
    <div
      id="results-table"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme
        flex flex-col gap-4 relative
      "
    >
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>Search Results</span>
            <Badge variant="default" size="sm">
              {results.length} found
            </Badge>
          </h3>
          {submittedQuery && (
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Query: <strong className="text-[var(--text-secondary)]">{submittedQuery}</strong> ·
              Alpha: <strong className="gradient-text font-mono">{alpha.toFixed(2)}</strong>
            </p>
          )}
        </div>

        {/* B7: Export Buttons */}
        {results.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={<FileSpreadsheet size={13} aria-hidden="true" />}
              title="Export results as CSV"
              aria-label="Export results as CSV"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJSON}
              icon={<FileJson size={13} aria-hidden="true" />}
              title="Export results as JSON"
              aria-label="Export results as JSON"
            >
              JSON
            </Button>
          </div>
        )}
      </div>

      {/* ── Score Breakdown Legend ── */}
      {showBreakdown && results.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <LegendDot color="#f97316" label="Relevance (TF-IDF)" />
          <LegendDot color="#ec4899" label="PageRank Authority" />
          <LegendDot color="#eab308" label="Final Fusion Score" />
          {showCosine && <LegendDot color="#8b5cf6" label="Raw Cosine" />}
        </div>
      )}

      {/* ── Weak Match Warning (Preserved) ── */}
      {isWeakMatch && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[12px] flex items-start gap-2.5 leading-relaxed"
        >
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Weak match advisory:</strong> No crawled page matches this query strongly (best
            raw cosine: <span className="font-mono font-semibold">{bestCosine.toFixed(4)}</span>).
            Relevance is scaled relative to the best matching page in the corpus.
          </span>
        </div>
      )}

      {/* ── 5 Async States via Shared AsyncState Component (Section 7C) ── */}
      <AsyncState
        loading={searchLoading}
        loadingMessage="Computing TF-IDF relevance and PageRank fusion..."
        offline={backendOffline}
        notCrawled={searchError?.kind === 'not_crawled' || !pipelineStatus?.crawled}
        onGoToCrawl={() => setTab('crawl')}
        error={searchError}
        isEmpty={!searchLoading && Boolean(submittedQuery) && results.length === 0}
        emptyTitle={`No pages matched "${submittedQuery}"`}
        emptyMessage="Either none of those terms appear in the crawled corpus, or they appear in so many pages that their IDF weight is zero. Try a more specific term or crawl more pages."
      >
        {/* Idle Initial State (before any search is submitted) */}
        {!submittedQuery && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center mb-3 shadow-glow text-white">
              <Download size={22} className="rotate-180" aria-hidden="true" />
            </div>
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
              Search the Crawled Corpus
            </h4>
            <p className="text-[12px] text-[var(--text-muted)] max-w-xs">
              Enter a keyword above (e.g. &apos;pagerank&apos; or &apos;algorithm&apos;) and press
              Search or Enter.
            </p>
          </div>
        )}

        {/* ── Results List ── */}
        {results.length > 0 && (
          <div className="flex flex-col gap-2" role="list" aria-label="Search results list">
            {results.map((r, idx) => {
              const isExpanded = expandedRowId === r.page_id;

              return (
                <div
                  key={r.page_id}
                  id={`result-row-${r.page_id}`}
                  role="listitem"
                  className={`
                    flex flex-col rounded-xl border transition-all duration-200
                    ${
                      isExpanded
                        ? 'border-[var(--accent-start)]/40 bg-[var(--card-hover)] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]'
                    }
                  `}
                >
                  {/* Result row top bar */}
                  <div className="flex items-start gap-3 p-3.5 w-full">
                    {/* Rank Badge */}
                    <span className="text-[12px] font-bold font-mono tabular-nums text-[var(--text-muted)] mt-1 w-6 shrink-0 text-center">
                      #{idx + 1}
                    </span>

                    {/* Result Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-semibold gradient-text truncate">
                          {r.title}
                        </span>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent-start)] shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5"
                          title="Open original Wikipedia page in new tab"
                          aria-label={`Open ${r.title} in new tab`}
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      </div>

                      {/* URL */}
                      <span className="text-[12px] text-[var(--text-muted)] font-mono truncate block mb-2">
                        {r.url}
                      </span>

                      {/* Score Bars */}
                      {showBreakdown && (
                        <div className="flex flex-col gap-1.5 w-full max-w-xl">
                          <ScoreBar label="Relevance" value={r.relevance} color="orange" />
                          <ScoreBar label="PageRank" value={r.pagerank} color="pink" />
                          <ScoreBar label="Final Score" value={r.final} color="yellow" />
                          {showCosine && (
                            <ScoreBar label="Raw Cosine" value={r.raw_cosine} color="purple" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons: Why this rank? (B3) & Expand (B6) */}
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {/* B3: Why this rank? button */}
                      <button
                        type="button"
                        onClick={() => setActiveRankExplain(r)}
                        className="
                          flex items-center gap-1 px-2.5 py-1 rounded-lg
                          bg-[var(--bg)] hover:bg-[var(--card-hover)]
                          border border-[var(--border)] hover:border-[var(--border-hover)]
                          text-[11px] font-semibold text-[var(--text-secondary)]
                          transition-all cursor-pointer shadow-sm
                        "
                        title="View mathematical score breakdown"
                        aria-label={`Why this rank for ${r.title}`}
                      >
                        <Calculator
                          size={12}
                          className="text-[var(--accent-start)]"
                          aria-hidden="true"
                        />
                        <span>Why this rank?</span>
                      </button>

                      {/* B6: Expandable chevron button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleExpand(e, r.page_id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse row details' : 'Expand row details'}
                        className="
                          p-1.5 rounded-lg text-[var(--text-muted)]
                          hover:text-[var(--text-primary)] hover:bg-[var(--bg)]
                          transition-all cursor-pointer
                        "
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} aria-hidden="true" />
                        ) : (
                          <ChevronRight size={16} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* B6: Inline expanded page detail view */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 border-t border-[var(--border)] animate-fade-in text-[12px]">
                      {selectedPageLoading ? (
                        <div className="py-4 text-[var(--text-muted)] animate-pulse">
                          Loading page metadata and link network...
                        </div>
                      ) : selectedPageDetail && selectedPageDetail.id === r.page_id ? (
                        <div className="flex flex-col gap-2.5 pt-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                              <span className="text-[11px] text-[var(--text-muted)] block">
                                PageRank Score
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">
                                {selectedPageDetail.pagerank.toFixed(5)}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                              <span className="text-[11px] text-[var(--text-muted)] block">
                                Graph In-Degree
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">
                                {selectedPageDetail.inDegree}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                              <span className="text-[11px] text-[var(--text-muted)] block">
                                Graph Out-Degree
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">
                                {selectedPageDetail.outDegree}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                              <span className="text-[11px] text-[var(--text-muted)] block">
                                Global Rank
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">
                                #{selectedPageDetail.rank}
                              </span>
                            </div>
                          </div>

                          {selectedPageDetail.inLinks.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                Inbound Links ({selectedPageDetail.inLinks.length})
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {selectedPageDetail.inLinks.map((link) => (
                                  <Badge key={link} variant="default" size="sm">
                                    {link}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-2 text-[var(--text-muted)]">
                          Detailed link statistics unavailable for this node.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AsyncState>

      {/* ── B3: "Why this rank?" Popover Modal ── */}
      {activeRankExplain && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rank-explain-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setActiveRankExplain(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-card-hover flex flex-col gap-4 text-left animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-[var(--accent-start)]" aria-hidden="true" />
                <h4
                  id="rank-explain-title"
                  className="text-[14px] font-bold text-[var(--text-primary)]"
                >
                  Why This Rank: {activeRankExplain.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveRankExplain(null)}
                aria-label="Close rank explanation"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Arithmetic substitution */}
            {(() => {
              const explain = explainRankScore(
                alpha,
                activeRankExplain.relevance,
                activeRankExplain.pagerank
              );
              return (
                <div className="flex flex-col gap-3 text-[12px]">
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    Final score is computed using the linear blend formula where relevance and
                    PageRank are both normalised so the highest-scoring corpus page equals 1.0.
                  </p>

                  <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] font-mono text-[13px] text-[var(--accent-start)] text-center font-bold">
                    {explain.formulaString}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">
                        TF-IDF Relevance Contribution
                      </span>
                      <span className="text-[13px] font-bold font-mono text-orange-500">
                        {explain.alpha.toFixed(2)} × {explain.relevance.toFixed(4)} ={' '}
                        {explain.relevanceComponent.toFixed(4)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">
                        PageRank Authority Contribution
                      </span>
                      <span className="text-[13px] font-bold font-mono text-pink-500">
                        {explain.oneMinusAlpha.toFixed(2)} × {explain.pagerank.toFixed(4)} ={' '}
                        {explain.pagerankComponent.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] flex items-start gap-2">
                    <HelpCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Alpha weight {alpha.toFixed(2)} allocates {(alpha * 100).toFixed(0)}% weight
                      to query content match and {((1 - alpha) * 100).toFixed(0)}% to hyperlink
                      authority.
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setActiveRankExplain(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Legend dot helper ── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[12px] font-medium text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
