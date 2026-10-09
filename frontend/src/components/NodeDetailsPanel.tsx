import { X, ExternalLink } from 'lucide-react';
import { mockPages } from '../mockData';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   NodeDetailsPanel — Details for a selected graph node
   Shows PageRank, in-links, out-links and source URL
   ═══════════════════════════════════════════════════ */

export default function NodeDetailsPanel() {
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);

  if (!selectedNode) return null;

  const page = mockPages.find((p) => p.id === selectedNode);
  if (!page) return null;

  // Rank among all pages by pagerank
  const sorted = [...mockPages].sort((a, b) => b.pagerank - a.pagerank);
  const rank = sorted.findIndex((p) => p.id === page.id) + 1;

  const wikiUrl = `https://en.wikipedia.org/wiki/${page.title.replace(/ /g, '_')}`;

  return (
    <div
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
            {page.title}
          </h3>
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center gap-1 mt-1
              text-[11px] text-[var(--tab-active-text)]
              hover:opacity-80 transition-opacity truncate
            "
          >
            <ExternalLink size={10} className="flex-shrink-0" />
            <span className="truncate">en.wikipedia.org/wiki/{page.title.replace(/ /g, '_')}</span>
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
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="
            rounded-xl p-3
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            PageRank
          </p>
          <p className="text-base font-bold gradient-text">
            {page.pagerank.toFixed(3)}
          </p>
        </div>
        <div
          className="
            rounded-xl p-3
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            Rank
          </p>
          <p className="text-base font-bold text-[var(--text-primary)]">
            #{rank}
          </p>
        </div>
        <div
          className="
            rounded-xl p-3
            bg-[var(--bg)] border border-[var(--border)]
            text-center
          "
        >
          <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">
            In-degree
          </p>
          <p className="text-base font-bold text-[var(--text-primary)]">
            {page.inLinks.length}
          </p>
        </div>
      </div>

      {/* ── In-links ── */}
      <div className="mb-4">
        <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          In-links (Top 5)
        </h4>
        <ol className="list-decimal list-inside space-y-1">
          {page.inLinks.slice(0, 5).map((title, i) => (
            <li
              key={i}
              className="text-[12px] text-[var(--text-primary)] truncate"
            >
              <span className="text-[var(--text-secondary)]">{title}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Out-links ── */}
      <div>
        <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Out-links (Top 5)
        </h4>
        <ol className="list-decimal list-inside space-y-1">
          {page.outLinks.slice(0, 5).map((title, i) => (
            <li
              key={i}
              className="text-[12px] text-[var(--text-primary)] truncate"
            >
              <span className="text-[var(--text-secondary)]">{title}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
