import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Network,
} from 'lucide-react';
import * as d3 from 'd3';
import { mockPages, mockLinks } from '../mockData';
import { useAppStore } from '../store/useAppStore';
import type { Page } from '../types';
import NodeDetailsPanel from './NodeDetailsPanel';

/* ═══════════════════════════════════════════════════
   LinkGraphPanel — Force-directed graph visualization
   Uses d3-force on an SVG with zoom controls,
   layout modes, and node size/color by PageRank tier
   ═══════════════════════════════════════════════════ */

/* ── Graph data helpers ── */

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  pagerank: number;
  inLinks: string[];
  outLinks: string[];
  page: Page;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// Top 30 pages by PageRank
const top30 = [...mockPages]
  .sort((a, b) => b.pagerank - a.pagerank)
  .slice(0, 30);

const top30Titles = new Set(top30.map((p) => p.title));

function buildGraphData(): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = top30.map((p) => ({
    id: p.id,
    title: p.title,
    pagerank: p.pagerank,
    inLinks: p.inLinks,
    outLinks: p.outLinks,
    page: p,
  }));

  const nodeById = new Map(nodes.map((n) => [n.title, n]));

  const links: GraphLink[] = mockLinks
    .filter(
      (l) =>
        top30Titles.has(l.source as string) &&
        top30Titles.has(l.target as string)
    )
    .map((l) => ({
      source: nodeById.get(l.source as string)!.id,
      target: nodeById.get(l.target as string)!.id,
    }));

  return { nodes, links };
}

/* ── Color tiers ── */
function nodeColor(page: Page, sortedPages: Page[]): string {
  const idx = sortedPages.findIndex((p) => p.id === page.id);
  if (idx < 3) return '#f97316'; // orange — top 3
  if (idx < 7) return '#ec4899'; // pink — mid
  return '#6b7280'; // gray — low
}

/* ── Radius helpers ── */
function radiusByPagerank(pr: number): number {
  // Scale from 8px to 28px based on pagerank
  const min = 8,
    max = 28;
  const maxPR = Math.max(...top30.map((p) => p.pagerank));
  const minPR = Math.min(...top30.map((p) => p.pagerank));
  if (maxPR === minPR) return (min + max) / 2;
  return min + ((pr - minPR) / (maxPR - minPR)) * (max - min);
}

function radiusByInDegree(inLinks: string[]): number {
  const min = 8,
    max = 28;
  const maxDeg = Math.max(...top30.map((p) => p.inLinks.length));
  const minDeg = Math.min(...top30.map((p) => p.inLinks.length));
  if (maxDeg === minDeg) return (min + max) / 2;
  return min + ((inLinks.length - minDeg) / (maxDeg - minDeg)) * (max - min);
}

/* ── Component ── */
export default function LinkGraphPanel() {
  const vs = useAppStore((s) => s.visualSettings);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphTab, setGraphTab] = useState<'graph' | 'details'>('graph');

  // Sort pages once for color assignment
  const sortedPages = useMemo(
    () => [...mockPages].sort((a, b) => b.pagerank - a.pagerank),
    []
  );

  // Graph data — stable reference
  const graphData = useMemo(() => buildGraphData(), []);

  /* ── Determine node radius ── */
  const getRadius = useCallback(
    (node: GraphNode) => {
      if (vs.nodeSize === 'uniform') return 14;
      if (vs.nodeSize === 'in-degree') return radiusByInDegree(node.inLinks);
      return radiusByPagerank(node.pagerank);
    },
    [vs.nodeSize]
  );

  /* ── Determine if node gets a label ── */
  const showLabelFor = useCallback(
    (node: GraphNode) => {
      if (!vs.showLabels) return false;
      const idx = sortedPages.findIndex((p) => p.id === node.id);
      return idx < 6;
    },
    [vs.showLabels, sortedPages]
  );

  /* ── Position computers for non-force layouts ── */
  const computeCircularPositions = useCallback(
    (
      nodes: GraphNode[],
      width: number,
      height: number
    ): { x: number; y: number }[] => {
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
    (
      nodes: GraphNode[],
      width: number,
      height: number
    ): { x: number; y: number }[] => {
      // Three tiers: top-3, mid (3-7), rest
      const tiers: GraphNode[][] = [[], [], []];
      const sorted = [...nodes].sort((a, b) => b.pagerank - a.pagerank);
      sorted.forEach((n, i) => {
        if (i < 3) tiers[0].push(n);
        else if (i < 7) tiers[1].push(n);
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
    if (!svg || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 480;

    // Clear previous
    const svgSel = d3.select(svg);
    svgSel.selectAll('*').remove();

    svgSel.attr('viewBox', `0 0 ${width} ${height}`);

    // ── Defs: arrow marker ──
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

    const g = svgSel
      .append('g')
      .attr('class', 'graph-layer');

    // Deep-copy nodes/links so d3 mutation doesn't corrupt source
    const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = graphData.links.map((l) => ({
      source: l.source as string,
      target: l.target as string,
    }));

    // ── Links ──
    const linkSel = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)');

    // ── Nodes ──
    const nodeSel = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes, (d) => d.id)
      .join('circle')
      .attr('r', (d) => getRadius(d))
      .attr('fill', (d) => nodeColor(d.page, sortedPages))
      .attr('stroke', 'var(--card)')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .attr('opacity', 0.9)
      .on('click', (_, d) => {
        setSelectedNode(d.id);
        // On narrow screens, switch to details tab
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

    // ── Labels ──
    const labelSel = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes.filter((n) => showLabelFor(n)), (d) => d.id)
      .join('text')
      .text((d) => d.title)
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'var(--text-primary)')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    // ── Apply layout ──
    const applyPositions = (animate: boolean) => {
      if (vs.layout === 'force-directed') {
        // d3 forceSimulation
        if (simRef.current) simRef.current.stop();

        const sim = d3
          .forceSimulation<GraphNode>(nodes)
          .force(
            'link',
            d3
              .forceLink<GraphNode, GraphLink>(links)
              .id((d) => d.id)
              .distance(120)
          )
          .force('charge', d3.forceManyBody<GraphNode>().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide<GraphNode>().radius((d) => getRadius(d) + 4))
          .on('tick', () => {
            linkSel
              .attr('x1', (d: any) => d.source.x)
              .attr('y1', (d: any) => d.source.y)
              .attr('x2', (d: any) => {
                // Shorten line by target radius so arrow sits at circle edge
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
        // Static layouts
        if (simRef.current) {
          simRef.current.stop();
          simRef.current = null;
        }

        const positions =
          vs.layout === 'circular'
            ? computeCircularPositions(nodes, width, height)
            : computeHierarchicalPositions(nodes, width, height);

        nodes.forEach((n, i) => {
          n.x = positions[i].x;
          n.y = positions[i].y;
        });

        // Build a lookup for positioned nodes
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        if (animate && vs.animateOnUpdate) {
          nodeSel
            .transition()
            .duration(600)
            .attr('cx', (d) => nodeMap.get(d.id)!.x!)
            .attr('cy', (d) => nodeMap.get(d.id)!.y!);

          labelSel
            .transition()
            .duration(600)
            .attr('x', (d) => nodeMap.get(d.id)!.x!)
            .attr('y', (d) => nodeMap.get(d.id)!.y! - getRadius(d) - 6);

          linkSel
            .transition()
            .duration(600)
            .attr('x1', (d: any) => {
              const s = nodeMap.get(typeof d.source === 'string' ? d.source : d.source.id);
              return s?.x ?? 0;
            })
            .attr('y1', (d: any) => {
              const s = nodeMap.get(typeof d.source === 'string' ? d.source : d.source.id);
              return s?.y ?? 0;
            })
            .attr('x2', (d: any) => {
              const tId = typeof d.target === 'string' ? d.target : d.target.id;
              const sId = typeof d.source === 'string' ? d.source : d.source.id;
              const t = nodeMap.get(tId);
              const s = nodeMap.get(sId);
              if (!t || !s) return 0;
              const dx = t.x! - s.x!;
              const dy = t.y! - s.y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(nodes.find((n) => n.id === tId)!);
              return dist > 0 ? t.x! - (dx / dist) * r : t.x!;
            })
            .attr('y2', (d: any) => {
              const tId = typeof d.target === 'string' ? d.target : d.target.id;
              const sId = typeof d.source === 'string' ? d.source : d.source.id;
              const t = nodeMap.get(tId);
              const s = nodeMap.get(sId);
              if (!t || !s) return 0;
              const dx = t.x! - s.x!;
              const dy = t.y! - s.y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(nodes.find((n) => n.id === tId)!);
              return dist > 0 ? t.y! - (dy / dist) * r : t.y!;
            });
        } else {
          // Snap immediately
          nodeSel
            .attr('cx', (d) => nodeMap.get(d.id)!.x!)
            .attr('cy', (d) => nodeMap.get(d.id)!.y!);

          labelSel
            .attr('x', (d) => nodeMap.get(d.id)!.x!)
            .attr('y', (d) => nodeMap.get(d.id)!.y! - getRadius(d) - 6);

          linkSel
            .attr('x1', (d: any) => {
              const s = nodeMap.get(typeof d.source === 'string' ? d.source : d.source.id);
              return s?.x ?? 0;
            })
            .attr('y1', (d: any) => {
              const s = nodeMap.get(typeof d.source === 'string' ? d.source : d.source.id);
              return s?.y ?? 0;
            })
            .attr('x2', (d: any) => {
              const tId = typeof d.target === 'string' ? d.target : d.target.id;
              const sId = typeof d.source === 'string' ? d.source : d.source.id;
              const t = nodeMap.get(tId);
              const s = nodeMap.get(sId);
              if (!t || !s) return 0;
              const dx = t.x! - s.x!;
              const dy = t.y! - s.y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(nodes.find((n) => n.id === tId)!);
              return dist > 0 ? t.x! - (dx / dist) * r : t.x!;
            })
            .attr('y2', (d: any) => {
              const tId = typeof d.target === 'string' ? d.target : d.target.id;
              const sId = typeof d.source === 'string' ? d.source : d.source.id;
              const t = nodeMap.get(tId);
              const s = nodeMap.get(sId);
              if (!t || !s) return 0;
              const dx = t.x! - s.x!;
              const dy = t.y! - s.y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getRadius(nodes.find((n) => n.id === tId)!);
              return dist > 0 ? t.y! - (dy / dist) * r : t.y!;
            });
        }
      }
    };

    applyPositions(true);

    // Cleanup
    return () => {
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
    };
  }, [
    vs.layout,
    vs.nodeSize,
    vs.showLabels,
    vs.animateOnUpdate,
    getRadius,
    showLabelFor,
    graphData,
    sortedPages,
    setSelectedNode,
    computeCircularPositions,
    computeHierarchicalPositions,
  ]);

  /* ── Zoom transform ── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const gLayer = svg.querySelector('.graph-layer');
    if (gLayer) {
      (gLayer as SVGGElement).setAttribute(
        'transform',
        `scale(${zoom})`
      );
    }
  }, [zoom]);

  /* ── Zoom handlers ── */
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.3));
  const toggleFullscreen = () => setIsFullscreen((f) => !f);

  /* ── Wide layout detection ── */
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1400 : false
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1400px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mql.addEventListener('change', handler);
    setIsWide(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /* ── Legend items ── */
  const legendItems = [
    { color: '#f97316', label: 'High PR' },
    { color: '#ec4899', label: 'Medium PR' },
    { color: '#6b7280', label: 'Low PR' },
  ];

  /* ── Render ── */
  const fullscreenClasses = isFullscreen
    ? 'fixed inset-0 z-[100] bg-[var(--bg)] p-4'
    : '';

  return (
    <div className={fullscreenClasses}>
      <div className="flex gap-5 h-full">
        {/* ── Main graph area ── */}
        <div className={`flex-1 flex flex-col min-w-0 ${isFullscreen ? '' : ''}`}>
          {/* Tabs (narrow: graph / details toggle) */}
          {!isWide && selectedNode && (
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setGraphTab('graph')}
                className={`
                  px-4 py-1.5 rounded-full text-[12px] font-semibold
                  transition-colors cursor-pointer
                  ${
                    graphTab === 'graph'
                      ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
                      : 'text-[var(--tab-inactive-text)] hover:bg-[var(--tab-hover-bg)]'
                  }
                `}
              >
                Link Graph
              </button>
              <button
                onClick={() => setGraphTab('details')}
                className={`
                  px-4 py-1.5 rounded-full text-[12px] font-semibold
                  transition-colors cursor-pointer
                  ${
                    graphTab === 'details'
                      ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
                      : 'text-[var(--tab-inactive-text)] hover:bg-[var(--tab-hover-bg)]'
                  }
                `}
              >
                Node Details
              </button>
            </div>
          )}

          {/* Show graph or details based on tab (narrow) */}
          {(!selectedNode || isWide || graphTab === 'graph') && (
            <div
              className={`
                rounded-2xl border border-[var(--border)]
                bg-[var(--card)] shadow-card
                p-5 flex flex-col animate-fade-in
                ${isFullscreen ? 'flex-1' : ''}
              `}
            >
              {/* ── Card header ── */}
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
                    <Network size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Link Graph
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      (Top 30 pages by PageRank)
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="hidden sm:flex items-center gap-4">
                  {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">
                        {item.label}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-muted)] text-[10px]">→</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">
                      Link
                    </span>
                  </div>
                </div>
              </div>

              {/* ── SVG container ── */}
              <div
                ref={containerRef}
                className={`
                  relative rounded-xl overflow-hidden
                  bg-[var(--bg)] border border-[var(--border)]
                  ${isFullscreen ? 'flex-1' : 'h-[480px]'}
                `}
              >
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  style={{ overflow: 'visible' }}
                />

                {/* ── Zoom controls ── */}
                <div
                  className="
                    absolute bottom-3 right-3
                    flex flex-col gap-1
                  "
                >
                  <button
                    onClick={handleZoomIn}
                    className="
                      p-1.5 rounded-lg
                      bg-[var(--card)] border border-[var(--border)]
                      text-[var(--text-secondary)]
                      hover:bg-[var(--card-hover)]
                      transition-colors cursor-pointer
                      shadow-sm
                    "
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="
                      p-1.5 rounded-lg
                      bg-[var(--card)] border border-[var(--border)]
                      text-[var(--text-secondary)]
                      hover:bg-[var(--card-hover)]
                      transition-colors cursor-pointer
                      shadow-sm
                    "
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="
                      p-1.5 rounded-lg
                      bg-[var(--card)] border border-[var(--border)]
                      text-[var(--text-secondary)]
                      hover:bg-[var(--card-hover)]
                      transition-colors cursor-pointer
                      shadow-sm
                    "
                    aria-label="Toggle fullscreen"
                  >
                    {isFullscreen ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Narrow: show NodeDetails as tab content */}
          {!isWide && selectedNode && graphTab === 'details' && (
            <NodeDetailsPanel />
          )}
        </div>

        {/* ── Side-by-side NodeDetails (wide only) ── */}
        {isWide && selectedNode && (
          <div className="w-[320px] flex-shrink-0">
            <NodeDetailsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
