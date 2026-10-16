import { useEffect } from 'react';
import { Trophy, RotateCcw, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import AsyncState from './AsyncState';
import Badge from './ui/Badge';

/* ═══════════════════════════════════════════════════
   TopPagesPanel — Top pages ranked by PageRank authority
   Reads real rankings directly from GET /api/top
   Integrated with AsyncState (Section 7C) and 12px minimum typography.
   ═══════════════════════════════════════════════════ */

export default function TopPagesPanel() {
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const topPages = useAppStore((s) => s.topPages);
  const topPagesLoading = useAppStore((s) => s.topPagesLoading);
  const topPagesError = useAppStore((s) => s.topPagesError);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);

  useEffect(() => {
    if (pipelineStatus?.crawled && topPages.length === 0) {
      loadTopPages(10);
    }
  }, [pipelineStatus?.crawled, topPages.length, loadTopPages]);

  const maxPR = topPages.length > 0 ? Math.max(...topPages.map((p) => p.pagerank)) : 1.0;

  return (
    <div
      id="top-pages-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="
              w-8 h-8 rounded-xl
              bg-accent-gradient
              flex items-center justify-center
              shadow-glow text-white shrink-0
            "
          >
            <Trophy size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
              Top Authoritative Pages
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">
              Global PageRank link graph distribution
            </p>
          </div>
        </div>

        {pipelineStatus?.crawled && (
          <button
            onClick={() => loadTopPages(10)}
            disabled={topPagesLoading}
            className="
              flex items-center gap-1.5 px-2.5 py-1 rounded-lg
              bg-[var(--bg)] hover:bg-[var(--card-hover)]
              border border-[var(--border)] hover:border-[var(--border-hover)]
              text-[12px] font-medium text-[var(--text-secondary)]
              transition-all cursor-pointer shadow-sm
            "
            title="Refresh top rankings"
            aria-label="Refresh top rankings"
          >
            <RotateCcw
              size={12}
              className={topPagesLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* ── 5 Async States via Shared Component ── */}
      <AsyncState
        loading={topPagesLoading}
        loadingMessage="Loading PageRank authority scores..."
        offline={backendOffline}
        notCrawled={!pipelineStatus?.crawled}
        onGoToCrawl={() => setTab('crawl')}
        error={topPagesError}
        onRetry={() => loadTopPages(10)}
        isEmpty={pipelineStatus?.crawled && topPages.length === 0}
        emptyTitle="No pages ranked yet"
        emptyMessage="Run a crawl session to calculate PageRank for pages in the corpus."
        emptyAction={{
          label: 'Open Crawl Panel',
          onClick: () => setTab('crawl'),
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-[var(--text-muted)] border-b border-[var(--border)] text-[11px] uppercase tracking-wider font-semibold">
                <th scope="col" className="py-2.5 pr-2 w-10">
                  Rank
                </th>
                <th scope="col" className="py-2.5 pr-3">
                  Page Title
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right w-24">
                  PageRank
                </th>
                <th scope="col" className="py-2.5 pl-3 w-36">
                  Authority
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topPages.map((page, idx) => {
                const isSelected = selectedNode === page.id;
                const prPercent = ((page.pagerank / (maxPR || 1)) * 100).toFixed(0);

                return (
                  <tr
                    key={page.id}
                    onClick={() => setSelectedNode(page.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedNode(page.id);
                      }
                    }}
                    className={`
                      transition-colors cursor-pointer group
                      ${isSelected ? 'bg-[var(--sidebar-active)]' : 'hover:bg-[var(--card-hover)]'}
                    `}
                  >
                    {/* Rank */}
                    <td className="py-2.5 pr-2 font-mono font-bold tabular-nums text-[var(--text-muted)]">
                      #{idx + 1}
                    </td>

                    {/* Title & External Link */}
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-start)] transition-colors truncate max-w-xs">
                          {page.title}
                        </span>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[var(--accent-start)] opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                          title="Open original page in new tab"
                          aria-label={`Open ${page.title} in new tab`}
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>
                    </td>

                    {/* Numeric PageRank (font-mono tabular-nums) */}
                    <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums text-[var(--text-secondary)]">
                      {page.pagerank.toFixed(5)}
                    </td>

                    {/* Authority Bar */}
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-gradient transition-all duration-300"
                            style={{ width: `${prPercent}%` }}
                          />
                        </div>
                        <Badge variant="accent" size="sm">
                          {prPercent}%
                        </Badge>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
