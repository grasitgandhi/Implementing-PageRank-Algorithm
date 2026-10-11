import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Network,
  Loader2,
} from 'lucide-react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import type { GraphNode as ApiGraphNode } from '../types';
import NodeDetailsPanel from './NodeDetailsPanel';

/* ═══════════════════════════════════════════════════
   LinkGraphPanel — Force-directed graph visualization
   Renders the real crawled graph from /api/graph
   ═══════════════════════════════════════════════════ */

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  url: string;
  pagerank: number;
  inDegree: number;
  outDegree: number;
  inLinks: string[];
  outLinks: string[];
  rank: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

/* ── Color tiers ── */
function nodeColor(node: D3Node, sortedNodes: D3Node[]): string {
  const idx = sortedNodes.findIndex((p) => p.id === node.id);
  if (idx < 3) return '#f97316'; // orange — top 3
  if (idx < 7) return '#ec4899'; // pink — mid
  return '#6b7280'; // gray — low
}

/* ── Radius helpers ── */
function radiusByPagerank(pr: number, nodes: D3Node[]): number {
  const min = 8, max = 28;
  if (nodes.length === 0) return 14;
  const prs = nodes.map((p) => p.pagerank);
  const maxPR = Math.max(...prs);
  const minPR = Math.min(...prs);
  if (maxPR === minPR) return (min + max) / 2;
  return min + ((pr - minPR) / (maxPR - minPR)) * (max - min);
}

function radiusByInDegree(inDeg: number, nodes: D3Node[]): number {
  const min = 8, max = 28;
  if (nodes.length === 0) return 14;
  const degs = nodes.map((p) => p.inDegree);
  const maxDeg = Math.max(...degs);
  const minDeg = Math.min(...degs);
  if (maxDeg === minDeg) return (min + max) / 2;
  return min + ((inDeg - minDeg) / (maxDeg - minDeg)) * (max - min);
}

export default function LinkGraphPanel() {
  const vs = useAppStore((s) => s.visualSettings);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);

  const graphData = useAppStore((s) => s.graphData);
  const graphLoading = useAppStore((s) => s.graphLoading);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setTab = useAppStore((s) => s.setTab);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphTab, setGraphTab] = useState<'graph' | 'details'>('graph');
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    if (pipelineStatus?.crawled && !graphData) {
      loadGraph(30);
    }
  }, [pipelineStatus?.crawled, graphData, loadGraph]);

  // Track window width
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 1400);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When node is selected on narrow screens, show details
  useEffect(() => {
    if (selectedNode && !isWide) {
      setGraphTab('details');
    }
  }, [selectedNode, isWide]);

  const rawNodes: D3Node[] = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.map((n) => ({
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
  }, [graphData]);

  const sortedNodes = useMemo(() => {
    return [...rawNodes].sort((a, b) => b.pagerank - a.pagerank);
  }, [rawNodes]);

  const getRadius = useCallback(
    (node: D3Node) => {
      if (vs.nodeSize === 'uniform') return 14;
      if (vs.nodeSize === 'in-degree') return radiusByInDegree(node.inDegree, rawNodes);
      return radiusByPagerank(node.pagerank, rawNodes);
    },
    [vs.nodeSize, rawNodes]
  );

  const showLabelFor = useCallback(
    (node: D3Node) => {
      if (!vs.showLabels) return false;
      const idx = sortedNodes.findIndex((p) => p.id === node.id);
      return idx < 8;
    },
    [vs.showLabels, sortedNodes]
  );

  const computeCircularPositions = useCallback(
    (nodes: D3Node[], width: number, height: number): { x: number; y: number }[] => {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.38;
      return nodes.map((_, i) => {
        const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
        return {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        };
      });
    },
    []
  );

  const computeHierarchicalPositions = useCallback(
    (nodes: D3Node[], width: number, height: number): { x: number; y: number }[] => {
      const tiers: D3Node[][] = [[], [], []];
      const sorted = [...nodes].sort((a, b) => b.pagerank - a.pagerank);
      sorted.forEach((n, i) => {
        if (i < 3) tiers[0].push(n);
        else if (i < 8) tiers[1].push(n);
        else tiers[2].push(n);
      });

      const positions = new Map<string, { x: number; y: number }>();
      const tierY = [height * 0.18, height * 0.48, height * 0.78];
      tiers.forEach((tier, ti) => {
        tier.forEach((n, ni) => {
          const x =
            tier.length === 1
              ? width / 2
              : ((ni + 0.5) / tier.length) * width;
          positions.set(n.id, { x, y: tierY[ti] });
        });
      });

      return nodes.map((n) => positions.get(n.id) || { x: width / 2, y: height / 2 });
    },
    []
  );

  /* ══════════════════════════════════════════
     D3 rendering effect
     ══════════════════════════════════════════ */
  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container || rawNodes.length === 0) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 480;

    const svgSel = d3.select(svg);
    svgSel.selectAll('*').remove();
    svgSel.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svgSel.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 0 10 7')
      .attr('refX', 10)
      .attr('refY', 3.5)
      .attr('markerWidth', 8)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L10,3.5 L0,7 Z')
      .attr('fill', 'var(--text-muted)');

    const g = svgSel.append('g').attr('class', 'graph-layer');

    const nodesCopy: D3Node[] = rawNodes.map((n) => ({ ...n }));
    const validIds = new Set(nodesCopy.map((n) => n.id));

    const linksCopy: D3Link[] = (graphData?.links || [])
      .filter((l) => validIds.has(l.source) && validIds.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
      }));

    const linkSel = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksCopy)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-opacity', vs.linkOpacity || 0.3)
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)');

    const nodeSel = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, D3Node>('circle')
      .data(nodesCopy, (d) => d.id)
      .join('circle')
      .attr('r', (d) => getRadius(d))
      .attr('fill', (d) => nodeColor(d, sortedNodes))
      .attr('stroke', 'var(--card)')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .attr('opacity', 0.9)
      .on('click', (_, d) => {
        setSelectedNode(d.id);
        if (window.innerWidth < 1400) {
          setGraphTab('details');
        }
      })
      .on('mouseenter', function () {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 3);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.9).attr('stroke-width', 2);
      });

    const labelSel = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, D3Node>('text')
      .data(nodesCopy.filter((n) => showLabelFor(n)), (d) => d.id)
      .join('text')
      .text((d) => d.title)
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'var(--text-primary)')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    // Layout application
    if (vs.layout === 'force-directed') {
      if (simRef.current) simRef.current.stop();

      const sim = d3
        .forceSimulation<D3Node>(nodesCopy)
        .force(
          'link',
          d3
            .forceLink<D3Node, D3Link>(linksCopy)
            .id((d) => d.id)
            .distance(vs.linkDistance || 120)
        )
        .force('charge', d3.forceManyBody<D3Node>().strength(vs.chargeStrength || -300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<D3Node>().radius((d) => getRadius(d) + 4))
        .on('tick', () => {
          linkSel
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => {
              const dx = d.target.x - d.source.x;
              const dy = d.target.y - d.source.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(d.target);
              return dist > 0 ? d.target.x - (dx / dist) * r : d.target.x;
            })
            .attr('y2', (d: any) => {
              const dx = d.target.x - d.source.x;
              const dy = d.target.y - d.source.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(d.target);
              return dist > 0 ? d.target.y - (dy / dist) * r : d.target.y;
            });

          nodeSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
          labelSel
            .attr('x', (d) => d.x!)
            .attr('y', (d) => d.y! - getRadius(d) - 6);
        });

      simRef.current = sim;
    } else {
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }

      const positions =
        vs.layout === 'circular'
          ? computeCircularPositions(nodesCopy, width, height)
          : computeHierarchicalPositions(nodesCopy, width, height);

      nodesCopy.forEach((n, i) => {
        n.x = positions[i].x;
        n.y = positions[i].y;
      });

      linkSel
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      labelSel
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y! - getRadius(d) - 6);
    }

    return () => {
      if (simRef.current) simRef.current.stop();
    };
  }, [
    rawNodes,
    sortedNodes,
    graphData,
    vs.layout,
    vs.linkDistance,
    vs.chargeStrength,
    vs.linkOpacity,
    vs.nodeSize,
    vs.showLabels,
    getRadius,
    showLabelFor,
    computeCircularPositions,
    computeHierarchicalPositions,
    setSelectedNode,
  ]);

  // Zoom handlers
  const handleZoomIn = () => {
    const next = Math.min(zoom + 0.2, 2.5);
    setZoom(next);
    d3.select(svgRef.current).select('.graph-layer').attr('transform', `scale(${next})`);
  };

  const handleZoomOut = () => {
    const next = Math.max(zoom - 0.2, 0.4);
    setZoom(next);
    d3.select(svgRef.current).select('.graph-layer').attr('transform', `scale(${next})`);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      id="link-graph-panel"
      className={`
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-5 animate-slide-in transition-theme flex flex-col gap-4
        ${isFullscreen ? 'fixed inset-4 z-50 overflow-auto' : ''}
      `}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="
              w-8 h-8 rounded-lg
              bg-accent-gradient
              flex items-center justify-center
              shadow-glow
            "
          >
            <Network size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Link graph
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              {rawNodes.length} nodes · {graphData?.links.length || 0} links
            </p>
          </div>
        </div>

        {/* Tab switch on narrow screens when node selected */}
        {!isWide && selectedNode && (
          <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setGraphTab('graph')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                graphTab === 'graph'
                  ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setGraphTab('details')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                graphTab === 'details'
                  ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Node Details
            </button>
          </div>
        )}
      </div>

      {/* ── Loading State ── */}
      {graphLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 size={32} className="animate-spin text-[var(--accent-start)] mb-3" />
          <p className="text-[13px] text-[var(--text-muted)]">Building link graph visualization...</p>
        </div>
      )}

      {/* ── Empty State ── */}
      {!graphLoading && (!pipelineStatus?.crawled || rawNodes.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[13px] text-[var(--text-muted)] mb-3">
            No crawled link graph yet. Run a crawl to extract Wikipedia links.
          </p>
          <button
            onClick={() => setTab('crawl')}
            className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-[12px] font-semibold shadow-glow cursor-pointer"
          >
            Go to Crawl
          </button>
        </div>
      )}

      {/* ── Visualization Canvas ── */}
      {!graphLoading && rawNodes.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Tiers Legend */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                  <span className="text-[var(--text-muted)]">Top 3 PageRank</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
                  <span className="text-[var(--text-muted)]">Mid Tier</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" />
                  <span className="text-[var(--text-muted)]">Standard</span>
                </span>
              </div>
            </div>

            {/* SVG container */}
            <div
              ref={containerRef}
              className={`
                relative rounded-xl overflow-hidden
                bg-[var(--bg)] border border-[var(--border)]
                ${isFullscreen ? 'flex-1' : 'h-[460px]'}
              `}
            >
              <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ overflow: 'visible' }}
              />

              {/* Zoom controls */}
              <div className="absolute bottom-3 right-3 flex flex-col gap-1">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)] cursor-pointer shadow-sm"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)] cursor-pointer shadow-sm"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)] cursor-pointer shadow-sm"
                  aria-label="Toggle fullscreen"
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Narrow details tab content */}
          {!isWide && selectedNode && graphTab === 'details' && (
            <NodeDetailsPanel />
          )}

          {/* Wide side-by-side NodeDetails */}
          {isWide && selectedNode && (
            <div className="w-[300px] shrink-0">
              <NodeDetailsPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
