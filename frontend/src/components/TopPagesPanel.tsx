import { useEffect } from 'react';
import { Trophy, ArrowRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   TopPagesPanel — Top 10 pages by PageRank
   Reads real rankings directly from /api/top
   ═══════════════════════════════════════════════════ */

export default function TopPagesPanel() {
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const topPages = useAppStore((s) => s.topPages);
  const topPagesLoading = useAppStore((s) => s.topPagesLoading);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
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
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="
              w-8 h-8 rounded-lg
              bg-accent-gradient
              flex items-center justify-center
              shadow-glow
            "
          >
            <Trophy size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Top pages
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              (PageRank authority)
            </p>
          </div>
        </div>

        {pipelineStatus?.crawled && (
          <button
            onClick={() => loadTopPages(10)}
            className="
              flex items-center gap-1 text-[11px] font-semibold
              text-[var(--tab-active-text)]
              hover:opacity-80 transition-opacity cursor-pointer
            "
          >
            Refresh
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* ── Loading State ── */}
      {topPagesLoading && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 size={24} className="animate-spin text-[var(--accent-start)] mb-2" />
          <p className="text-[12px] text-[var(--text-muted)]">Loading PageRank scores...</p>
        </div>
      )}

      {/* ── Empty State ── */}
      {!topPagesLoading && (!pipelineStatus?.crawled || topPages.length === 0) && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-[12px] text-[var(--text-muted)] mb-3">
            No crawled pages yet. Crawl web pages to see top rankings.
          </p>
          <button
            onClick={() => setTab('crawl')}
            className="px-3.5 py-1.5 rounded-xl bg-accent-gradient text-white text-[11px] font-semibold shadow-glow cursor-pointer"
          >
            Go to Crawl
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {!topPagesLoading && topPages.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-2 pr-2 font-semibold w-8">#</th>
                <th className="py-2 pr-3 font-semibold">Title</th>
                <th className="py-2 pr-3 font-semibold text-right w-20">
                  PageRank
                </th>
                <th className="py-2 font-semibold w-28" />
              </tr>
            </thead>
            <tbody>
              {topPages.map((page, idx) => {
                const isSelected = selectedNode === page.id;
                const percent = maxPR > 0 ? (page.pagerank / maxPR) * 100 : 0;
                return (
                  <tr
                    key={page.id}
                    onClick={() => setSelectedNode(page.id)}
                    className={`
                      border-b border-[var(--border)] last:border-b-0
                      cursor-pointer transition-colors duration-150
                      ${
                        isSelected
                          ? 'bg-[var(--sidebar-active)]'
                          : 'hover:bg-[var(--card-hover)]'
                      }
                    `}
                  >
                    <td className="py-2.5 pr-2 text-[var(--text-muted)] font-medium">
                      {page.rank || idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--text-primary)] font-medium truncate max-w-[160px]">
                      {page.title}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[var(--text-secondary)] font-mono tabular-nums">
                      {page.pagerank.toFixed(4)}
                    </td>
                    <td className="py-2.5">
                      <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, Math.min(100, percent))}%`,
                            background:
                              'linear-gradient(90deg, var(--accent-start), var(--accent-mid))',
                            transition: 'width 0.3s ease-out',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
