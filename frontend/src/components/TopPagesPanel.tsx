import { useEffect } from 'react';
import { Trophy, ArrowRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   TopPagesPanel — Top pages by PageRank
   Compact table with gradient bar visualization
   Connected directly to the real PageRank engine
   ═══════════════════════════════════════════════════ */

export default function TopPagesPanel() {
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setTab = useAppStore((s) => s.setTab);
  const topPages = useAppStore((s) => s.topPages);
  const topPagesLoading = useAppStore((s) => s.topPagesLoading);
  const topPagesError = useAppStore((s) => s.topPagesError);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
  const status = useAppStore((s) => s.status);

  useEffect(() => {
    if (status?.crawled && topPages.length === 0 && !topPagesLoading) {
      loadTopPages(10);
    }
  }, [status?.crawled, topPages.length, topPagesLoading, loadTopPages]);

  const maxPR = topPages.length > 0 ? topPages[0].pagerank : 1;

  return (
    <div
      id="top-pages-panel"
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
              (PageRank only)
            </p>
          </div>
        </div>

        <button
          onClick={() => setTab('top-pages')}
          className="
            flex items-center gap-1 text-[11px] font-semibold
            text-[var(--tab-active-text)]
            hover:opacity-80 transition-opacity cursor-pointer
          "
        >
          View all
          <ArrowRight size={12} />
        </button>
      </div>

      {/* ── Loading / Empty / Content ── */}
      {topPagesLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--accent-start)]" />
        </div>
      )}

      {!topPagesLoading && !status?.crawled && (
        <div className="py-6 text-center text-[12px] text-[var(--text-muted)]">
          No crawled pages yet. Run a crawl first.
        </div>
      )}

      {!topPagesLoading && status?.crawled && topPages.length === 0 && (
        <div className="py-6 text-center text-[12px] text-[var(--text-muted)]">
          {topPagesError || 'No top pages found.'}
        </div>
      )}

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
                <th className="py-2 font-semibold w-32" />
              </tr>
            </thead>
            <tbody>
              {topPages.map((page, idx) => {
                const isSelected = selectedNode === page.page_id;
                const barPercent = maxPR > 0 ? Math.min(100, (page.pagerank / maxPR) * 100) : 0;
                return (
                  <tr
                    key={page.page_id}
                    id={`top-page-row-${page.page_id}`}
                    onClick={() => setSelectedNode(page.page_id)}
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
                      {idx + 1}
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
                            width: `${barPercent}%`,
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
