import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Focus } from 'lucide-react';

/* ═══════════════════════════════════════════════════
   GraphControls — Viewport manipulation buttons (B5, Section 7A)
   Accessible zoom, fit-to-view, reset, and node count controls.
   ═══════════════════════════════════════════════════ */

export interface GraphControlsProps {
  maxNodes: number;
  onMaxNodesChange: (count: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onResetZoom: () => void;
}

export default function GraphControls({
  maxNodes,
  onMaxNodesChange,
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onResetZoom,
}: GraphControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Graph controls">
      {/* Node count selector */}
      <div className="flex items-center gap-1.5 mr-1">
        <label
          htmlFor="graph-node-count"
          className="text-[12px] text-[var(--text-muted)] font-medium"
        >
          Nodes:
        </label>
        <select
          id="graph-node-count"
          value={maxNodes}
          onChange={(e) => onMaxNodesChange(parseInt(e.target.value, 10))}
          className="
            rounded-lg px-2 py-1 text-[12px] font-semibold
            bg-[var(--bg)] text-[var(--text-primary)]
            border border-[var(--border)]
            focus:outline-none focus:ring-1 focus:ring-[var(--accent-start)]
            cursor-pointer
          "
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in graph"
        title="Zoom In"
        className="
          p-1.5 rounded-lg border border-[var(--border)]
          bg-[var(--bg)] hover:bg-[var(--card-hover)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          transition-colors cursor-pointer shadow-sm
        "
      >
        <ZoomIn size={15} aria-hidden="true" />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out graph"
        title="Zoom Out"
        className="
          p-1.5 rounded-lg border border-[var(--border)]
          bg-[var(--bg)] hover:bg-[var(--card-hover)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          transition-colors cursor-pointer shadow-sm
        "
      >
        <ZoomOut size={15} aria-hidden="true" />
      </button>

      {/* Fit to View */}
      <button
        type="button"
        onClick={onFitToView}
        aria-label="Fit graph to view"
        title="Fit to View"
        className="
          p-1.5 rounded-lg border border-[var(--border)]
          bg-[var(--bg)] hover:bg-[var(--card-hover)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          transition-colors cursor-pointer shadow-sm
        "
      >
        <Focus size={15} aria-hidden="true" />
      </button>

      {/* Reset Zoom */}
      <button
        type="button"
        onClick={onResetZoom}
        aria-label="Reset zoom and pan"
        title="Reset Zoom"
        className="
          p-1.5 rounded-lg border border-[var(--border)]
          bg-[var(--bg)] hover:bg-[var(--card-hover)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          transition-colors cursor-pointer shadow-sm
        "
      >
        <RotateCcw size={14} aria-hidden="true" />
      </button>

      {/* Fullscreen Toggle */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen graph' : 'Expand graph fullscreen'}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        className="
          p-1.5 rounded-lg border border-[var(--border)]
          bg-[var(--bg)] hover:bg-[var(--card-hover)]
          text-[var(--text-secondary)] hover:text-[var(--text-primary)]
          transition-colors cursor-pointer shadow-sm
        "
      >
        {isFullscreen ? (
          <Minimize2 size={15} aria-hidden="true" />
        ) : (
          <Maximize2 size={15} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
