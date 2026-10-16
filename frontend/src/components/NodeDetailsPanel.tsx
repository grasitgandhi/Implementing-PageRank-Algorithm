import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   NodeDetailsPanel — Details for a selected graph node
   Shows real PageRank, in-links, out-links, and Wikipedia URL.
   Strict 12px text minimum, tabular numerals, accessible lists.
   ═══════════════════════════════════════════════════ */

export default function NodeDetailsPanel() {
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const page = useAppStore((s) => s.selectedPageDetail);
  const loading = useAppStore((s) => s.selectedPageLoading);

  if (!selectedNode) return null;

  return (
    <div
      id="node-details-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-fade-in transition-theme
        flex flex-col gap-4
      "
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate">
            {page ? page.title : selectedNode.replace(/_/g, ' ')}
          </h3>
          {page && (
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center gap-1.5 mt-1
                text-[12px] text-[var(--tab-active-text)]
                hover:opacity-80 transition-opacity truncate
              "
            >
              <ExternalLink size={12} className="flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{page.url}</span>
            </a>
          )}
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="
            p-1.5 rounded-lg
            text-[var(--text-muted)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--card-hover)]
            transition-colors cursor-pointer
          "
          aria-label="Close node details"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div
          className="flex items-center justify-center py-6"
          role="status"
          aria-label="Loading node details"
        >
          <Loader2 size={20} className="animate-spin text-[var(--accent-start)]" />
        </div>
      )}

      {/* ── Stats ── */}
      {!loading && page && (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)] text-center">
              <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
                PageRank
              </p>
              <p className="text-base font-bold font-mono tabular-nums gradient-text">
                {page.pagerank.toFixed(4)}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)] text-center">
              <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
                Rank
              </p>
              <p className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                #{page.rank}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)] text-center">
              <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
                In-degree
              </p>
              <p className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                {page.inDegree}
              </p>
            </div>
          </div>

          {/* ── In-links ── */}
          <div>
            <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              In-links ({page.inLinks.length})
            </h4>
            {page.inLinks.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] italic">
                No incoming links in crawled subgraph
              </p>
            ) : (
              <ol className="list-decimal list-inside space-y-1">
                {page.inLinks.slice(0, 5).map((title, i) => (
                  <li
                    key={i}
                    onClick={() => setSelectedNode(title)}
                    className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer truncate"
                  >
                    <span>{title.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* ── Out-links ── */}
          <div>
            <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Out-links ({page.outLinks.length})
            </h4>
            {page.outLinks.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] italic">
                No outgoing links (dangling node)
              </p>
            ) : (
              <ol className="list-decimal list-inside space-y-1">
                {page.outLinks.slice(0, 5).map((title, i) => (
                  <li
                    key={i}
                    onClick={() => setSelectedNode(title)}
                    className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer truncate"
                  >
                    <span>{title.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}
