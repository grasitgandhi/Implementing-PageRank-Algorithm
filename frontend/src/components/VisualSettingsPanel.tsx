import { Settings2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   VisualSettingsPanel — Controls for graph display (P5 reachable)
   Node size, layout, labels, charge strength, link distance, and opacity.
   All values persist in localStorage under pagerank-ui-visual-settings (B9).
   ═══════════════════════════════════════════════════ */

export default function VisualSettingsPanel() {
  const vs = useAppStore((s) => s.visualSettings);
  const setVS = useAppStore((s) => s.setVisualSettings);

  return (
    <div
      id="visual-settings-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--border)] pb-3">
        <div
          aria-hidden="true"
          className="
            w-8 h-8 rounded-xl
            bg-accent-gradient
            flex items-center justify-center
            shadow-glow text-white shrink-0
          "
        >
          <Settings2 size={16} />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Visual Settings</h3>
          <p className="text-[12px] text-[var(--text-muted)]">
            Graph physics and layout preferences
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* ── Node size ── */}
        <div>
          <label
            htmlFor="vs-node-size"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Node Sizing Metric
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
              w-full rounded-xl px-3 py-2 text-[12px]
              bg-[var(--bg)] text-[var(--text-primary)]
              border border-[var(--border)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              transition-colors cursor-pointer
            "
          >
            <option value="pagerank">PageRank Authority</option>
            <option value="uniform">Uniform Radius</option>
            <option value="in-degree">In-Degree Count</option>
          </select>
        </div>

        {/* ── Layout ── */}
        <div>
          <label
            htmlFor="vs-layout"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Graph Layout Geometry
          </label>
          <select
            id="vs-layout"
            value={vs.layout}
            onChange={(e) =>
              setVS({
                layout: e.target.value as 'force-directed' | 'circular' | 'hierarchical',
              })
            }
            className="
              w-full rounded-xl px-3 py-2 text-[12px]
              bg-[var(--bg)] text-[var(--text-primary)]
              border border-[var(--border)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              transition-colors cursor-pointer
            "
          >
            <option value="force-directed">Force-directed (D3 Physics)</option>
            <option value="circular">Circular Perimeter</option>
            <option value="hierarchical">Hierarchical Ranked Layers</option>
          </select>
        </div>

        {/* ── Charge Strength Slider ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="vs-charge-strength"
              className="text-[12px] font-semibold text-[var(--text-secondary)]"
            >
              Repulsion Force (Charge)
            </label>
            <span className="text-[12px] font-mono tabular-nums text-[var(--text-muted)]">
              {vs.chargeStrength}
            </span>
          </div>
          <input
            id="vs-charge-strength"
            type="range"
            min={-800}
            max={-100}
            step={25}
            value={vs.chargeStrength}
            onChange={(e) => setVS({ chargeStrength: parseInt(e.target.value, 10) })}
            className="alpha-range w-full"
            aria-label="Repulsion charge strength"
          />
        </div>

        {/* ── Link Distance Slider ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="vs-link-distance"
              className="text-[12px] font-semibold text-[var(--text-secondary)]"
            >
              Link Distance
            </label>
            <span className="text-[12px] font-mono tabular-nums text-[var(--text-muted)]">
              {vs.linkDistance}px
            </span>
          </div>
          <input
            id="vs-link-distance"
            type="range"
            min={50}
            max={250}
            step={10}
            value={vs.linkDistance}
            onChange={(e) => setVS({ linkDistance: parseInt(e.target.value, 10) })}
            className="alpha-range w-full"
            aria-label="Graph link distance"
          />
        </div>

        {/* ── Checkboxes ── */}
        <div className="flex flex-col gap-2.5 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={vs.showLabels}
              onChange={(e) => setVS({ showLabels: e.target.checked })}
              className="
                w-4 h-4 rounded
                border-[var(--border)]
                cursor-pointer accent-[var(--accent-start)]
              "
            />
            <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              Always show node labels
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
