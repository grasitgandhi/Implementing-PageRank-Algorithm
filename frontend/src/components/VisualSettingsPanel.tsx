import { Settings2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   VisualSettingsPanel — Controls for graph display
   Node size, layout, labels, and animation toggles
   ═══════════════════════════════════════════════════ */

export default function VisualSettingsPanel() {
  const vs = useAppStore((s) => s.visualSettings);
  const setVS = useAppStore((s) => s.setVisualSettings);

  return (
    <div
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="
            w-8 h-8 rounded-lg
            bg-accent-gradient
            flex items-center justify-center
            shadow-glow
          "
        >
          <Settings2 size={16} className="text-white" />
        </div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Visual Settings
        </h3>
      </div>

      <div className="flex flex-col gap-4">
        {/* ── Node size ── */}
        <div>
          <label
            htmlFor="vs-node-size"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Node size
          </label>
          <select
            id="vs-node-size"
            value={vs.nodeSize}
            onChange={(e) =>
              setVS({
                nodeSize: e.target.value as 'pagerank' | 'uniform' | 'in-degree',
              })
            }
            className="
              w-full rounded-lg px-3 py-2 text-[12px]
              bg-[var(--bg)] text-[var(--text-primary)]
              border border-[var(--border)]
              focus:outline-none focus:border-[var(--tab-active-text)]
              transition-colors cursor-pointer
            "
          >
            <option value="pagerank">PageRank</option>
            <option value="uniform">Uniform</option>
            <option value="in-degree">In-degree</option>
          </select>
        </div>

        {/* ── Layout ── */}
        <div>
          <label
            htmlFor="vs-layout"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Layout
          </label>
          <select
            id="vs-layout"
            value={vs.layout}
            onChange={(e) =>
              setVS({
                layout: e.target.value as
                  | 'force-directed'
                  | 'circular'
                  | 'hierarchical',
              })
            }
            className="
              w-full rounded-lg px-3 py-2 text-[12px]
              bg-[var(--bg)] text-[var(--text-primary)]
              border border-[var(--border)]
              focus:outline-none focus:border-[var(--tab-active-text)]
              transition-colors cursor-pointer
            "
          >
            <option value="force-directed">Force-directed</option>
            <option value="circular">Circular</option>
            <option value="hierarchical">Hierarchical</option>
          </select>
        </div>

        {/* ── Checkboxes ── */}
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={vs.showLabels}
            onChange={(e) => setVS({ showLabels: e.target.checked })}
            className="
              w-4 h-4 rounded
              border-[var(--border)]
              text-[var(--tab-active-text)]
              focus:ring-[var(--tab-active-text)]
              cursor-pointer accent-[var(--accent-start)]
            "
          />
          <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            Show labels
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={vs.animateOnUpdate}
            onChange={(e) => setVS({ animateOnUpdate: e.target.checked })}
            className="
              w-4 h-4 rounded
              border-[var(--border)]
              text-[var(--tab-active-text)]
              focus:ring-[var(--tab-active-text)]
              cursor-pointer accent-[var(--accent-start)]
            "
          />
          <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            Animate on update
          </span>
        </label>
      </div>
    </div>
  );
}
