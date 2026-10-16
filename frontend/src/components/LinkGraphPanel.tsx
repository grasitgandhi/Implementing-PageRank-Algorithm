import { useState, useEffect, useMemo } from 'react';
import { Network, X } from 'lucide-react';
import { useAppStore } from '../../src/store/useAppStore';
import AsyncState from './AsyncState';
import NodeDetailsPanel from './NodeDetailsPanel';
import GraphControls from './graph/GraphControls';
import GraphLegend from './graph/GraphLegend';
import GraphTextFallback from './graph/GraphTextFallback';
import { useD3Graph } from './graph/useD3Graph';
import type { D3GraphNode, D3GraphLink } from './graph/types';

/* ═══════════════════════════════════════════════════
   LinkGraphPanel — Modular Graph Orchestration Component (P9 Fix)
   Split into data shaping, D3 physics hook, accessible fallback,
   and UI controls. Strictly typed without any or ts-ignore.
   ═══════════════════════════════════════════════════ */

export default function LinkGraphPanel() {
  const graphData = useAppStore((s) => s.graphData);
  const graphLoading = useAppStore((s) => s.graphLoading);
  const graphError = useAppStore((s) => s.graphError);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const visualSettings = useAppStore((s) => s.visualSettings);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);

  const [maxNodes, setMaxNodes] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (pipelineStatus?.crawled && !graphData) {
      loadGraph(maxNodes);
    }
  }, [pipelineStatus?.crawled, graphData, maxNodes, loadGraph]);

  const handleMaxNodesChange = (newCount: number) => {
    setMaxNodes(newCount);
    loadGraph(newCount);
  };

  // Convert API GraphData to D3 formatted data structures
  const { d3Nodes, d3Links } = useMemo(() => {
    if (!graphData?.nodes) {
      return { d3Nodes: [] as D3GraphNode[], d3Links: [] as D3GraphLink[] };
    }

    const nodes: D3GraphNode[] = graphData.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      pagerank: n.pagerank,
      inDegree: n.inDegree,
      outDegree: n.outDegree,
      inLinks: n.inLinks,
      outLinks: n.outLinks,
      rank: n.rank,
    }));

    const links: D3GraphLink[] = graphData.links.map((l) => ({
      source: l.source,
      target: l.target,
    }));

    return { d3Nodes: nodes, d3Links: links };
  }, [graphData]);

  // Hook managing D3 force simulation, pan/zoom, and ResizeObserver
  const {
    containerRef,
    svgRef,
    zoomGRef,
    dimensions,
    hoveredNode,
    setHoveredNode,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
  } = useD3Graph({
    nodes: d3Nodes,
    links: d3Links,
    visualSettings,
    selectedNode,
    onSelectNode: setSelectedNode,
  });

  // Clear hover & selection when clicking outside the graph panel
  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHoveredNode(null);
        setSelectedNode(null);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [containerRef, setHoveredNode, setSelectedNode]);

  return (
    <div
      id="link-graph-panel"
      className={`
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card transition-theme
        p-5 flex flex-col gap-4 animate-fade-in
        ${
          isFullscreen
            ? 'fixed inset-4 z-50 overflow-hidden shadow-2xl bg-[var(--card)]/95 backdrop-blur-lg'
            : 'relative'
        }
      `}
    >
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow text-white shrink-0"
          >
            <Network size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
              Link Graph Topology
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">
              {d3Nodes.length} nodes · {d3Links.length} directed hyperlink edges
            </p>
          </div>
        </div>

        {/* Viewport & node count controls */}
        {pipelineStatus?.crawled && (
          <GraphControls
            maxNodes={maxNodes}
            onMaxNodesChange={handleMaxNodesChange}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitToView={fitToView}
            onResetZoom={resetZoom}
          />
        )}
      </div>

      {/* ── 5 Async States via Shared AsyncState Component ── */}
      <AsyncState
        loading={graphLoading}
        loadingMessage="Generating D3 physics simulation and graph edges..."
        offline={backendOffline}
        notCrawled={!pipelineStatus?.crawled}
        onGoToCrawl={() => setTab('crawl')}
        error={graphError}
        onRetry={() => loadGraph(maxNodes)}
        isEmpty={pipelineStatus?.crawled && d3Nodes.length === 0}
        emptyTitle="Graph network is empty"
        emptyMessage="Crawl web pages to construct the Wikipedia link topology."
        emptyAction={{
          label: 'Open Crawl Panel',
          onClick: () => setTab('crawl'),
        }}
      >
        <div
          ref={containerRef}
          onMouseLeave={() => setHoveredNode(null)}
          className="relative w-full h-[420px] rounded-xl overflow-hidden bg-[var(--bg)] border border-[var(--border)] cursor-grab active:cursor-grabbing"
        >
          {/* Interactive SVG Canvas */}
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full"
            aria-label="Force directed Wikipedia hyperlink graph"
          >
            <g ref={zoomGRef} />
          </svg>

          {/* Hover / Selected Node Info Card */}
          {hoveredNode && (
            <div
              role="tooltip"
              className="absolute top-3 left-3 pointer-events-auto p-3 rounded-xl bg-[var(--card)]/95 border border-[var(--border)] shadow-card-hover backdrop-blur-md animate-fade-in text-[12px] max-w-xs flex items-start gap-2.5 z-10"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[var(--text-primary)] truncate">{hoveredNode.title}</h4>
                <div className="flex items-center gap-3 mt-1.5 font-mono text-[var(--text-secondary)]">
                  <span>
                    PageRank:{' '}
                    <strong className="gradient-text">{hoveredNode.pagerank.toFixed(4)}</strong>
                  </span>
                  <span>
                    In: {hoveredNode.inDegree} · Out: {hoveredNode.outDegree}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoveredNode(null)}
                aria-label="Close details"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <GraphLegend />

        {/* Accessible screen reader alternative directory */}
        <GraphTextFallback nodes={d3Nodes} onSelectNode={setSelectedNode} />

        {/* Selected Node Details Drawer */}
        <NodeDetailsPanel />
      </AsyncState>
    </div>
  );
}
