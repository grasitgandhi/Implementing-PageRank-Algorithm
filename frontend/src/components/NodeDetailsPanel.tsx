import { X, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   NodeDetailsPanel — Details for a selected graph node
   Shows PageRank, in-links, out-links and source URL
   Connected to the real backend data
   ═══════════════════════════════════════════════════ */

export default function NodeDetailsPanel() {
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const detail = useAppStore((s) => s.selectedNodeDetail);

  if (!selectedNode) return null;

  const title = detail?.title || selectedNode.replace(/_/g, ' ');
  const url = detail?.url || `https://en.wikipedia.org/wiki/${selectedNode}`;
  const pagerank = detail?.pagerank ?? 0;
  const rank = detail?.rank ?? 0;
  const inLinks = detail?.inLinks || [];
  const outLinks = detail?.outLinks || [];
  const inDegree = detail?.inDegree ?? inLinks.length;
  const outDegree = detail?.outDegree ?? outLinks.length;

  return (
    <div
      id="node-details-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-fade-in
        flex flex-col
      "
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
            {title}
          </h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center gap-1 mt-1
              text-[11px] text-[var(--tab-active-text)]
              hover:opacity-80 transition-opacity truncate
            "
          >
            <ExternalLink size={10} className="flex-shrink-0" />
            <span className="truncate">{url.replace('https://', '')}</span>
          </a>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="
            p-1 rounded-lg
            text-[var(--text-muted)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--card-hover)]
            transition-colors cursor-pointer
          "
          aria-label="Close node details"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div
          className="
            rounded-xl p-2.5
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            PageRank
          </p>
          <p className="text-sm font-bold gradient-text">
            {pagerank.toFixed(4)}
          </p>
        </div>
        <div
          className="
            rounded-xl p-2.5
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            Rank
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {rank > 0 ? `#${rank}` : '—'}
          </p>
        </div>
        <div
          className="
            rounded-xl p-2.5
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            In-deg
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {inDegree}
          </p>
        </div>
        <div
          className="
            rounded-xl p-2.5
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            Out-deg
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {outDegree}
          </p>
        </div>
      </div>

      {/* ── In-links ── */}
      <div className="mb-4">
        <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          In-links ({inLinks.length})
        </h4>
        {inLinks.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] italic">No in-links recorded</p>
        ) : (
          <ol className="list-decimal list-inside space-y-1 max-h-32 overflow-y-auto">
            {inLinks.slice(0, 10).map((linkId, i) => (
              <li
                key={i}
                onClick={() => setSelectedNode(linkId)}
                className="text-[12px] text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--accent-start)]"
              >
                <span className="text-[var(--text-secondary)]">{linkId.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Out-links ── */}
      <div>
        <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Out-links ({outLinks.length})
        </h4>
        {outLinks.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] italic">No out-links (dangling page)</p>
        ) : (
          <ol className="list-decimal list-inside space-y-1 max-h-32 overflow-y-auto">
            {outLinks.slice(0, 10).map((linkId, i) => (
              <li
                key={i}
                onClick={() => setSelectedNode(linkId)}
                className="text-[12px] text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--accent-start)]"
              >
                <span className="text-[var(--text-secondary)]">{linkId.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
