import { useRef, useEffect, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from 'd3';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3';
import { select, type Selection } from 'd3';
import type { D3GraphNode, D3GraphLink } from './types';
import type { VisualSettings } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  getNodeRadius,
  getNodeColor,
  computeCircularPositions,
  computeHierarchicalPositions,
  findNeighbours,
} from './graphDataShaping';

/* ═══════════════════════════════════════════════════
   useD3Graph — Custom Hook for D3 Physics, Zoom & Layout
   Extracts simulation state, zoom transformations, and
   ResizeObserver listener from the React rendering tree.
   ═══════════════════════════════════════════════════ */

interface UseD3GraphProps {
  nodes: D3GraphNode[];
  links: D3GraphLink[];
  visualSettings: VisualSettings;
  selectedNode: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export function useD3Graph({
  nodes,
  links,
  visualSettings,
  selectedNode,
  onSelectNode,
}: UseD3GraphProps) {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomGRef = useRef<SVGGElement>(null);
  const simRef = useRef<Simulation<D3GraphNode, D3GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const nodeSelRef = useRef<Selection<SVGCircleElement, D3GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<Selection<SVGLineElement, D3GraphLink, SVGGElement, unknown> | null>(null);
  const linksRef = useRef<D3GraphLink[]>([]);
  const selectedNodeRef = useRef<string | null>(selectedNode);
  selectedNodeRef.current = selectedNode;

  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [hoveredNode, setHoveredNode] = useState<D3GraphNode | null>(null);

  // ResizeObserver to resize graph when window or sidebar expands/collapses (Section 7C)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(Math.max(height, 350)),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  }, []);

  const zoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
  }, []);

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomBehaviorRef.current.transform, zoomIdentity);
  }, []);

  const fitToView = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current || nodes.length === 0) return;
    const { width, height } = dimensions;

    const xs = nodes.map((n) => n.x ?? width / 2);
    const ys = nodes.map((n) => n.y ?? height / 2);
    const minX = Math.min(...xs) - 40;
    const maxX = Math.max(...xs) + 40;
    const minY = Math.min(...ys) - 40;
    const maxY = Math.max(...ys) + 40;

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const scale = Math.min(width / dx, height / dy, 2.0) * 0.88;
    const translateX = width / 2 - scale * ((minX + maxX) / 2);
    const translateY = height / 2 - scale * ((minY + maxY) / 2);

    select(svgRef.current)
      .transition()
      .duration(400)
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(translateX, translateY).scale(scale)
      );
  }, [dimensions, nodes]);

  // Main D3 simulation setup and execution
  useEffect(() => {
    if (!svgRef.current || !zoomGRef.current || nodes.length === 0) return;
    const { width, height } = dimensions;

    const svg = select(svgRef.current);
    const zoomG = select(zoomGRef.current);

    // Setup zoom behavior
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        zoomG.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Deep clones of nodes and links for D3 simulation mutation
    const nodesCopy: D3GraphNode[] = nodes.map((n) => ({ ...n }));
    const linksCopy: D3GraphLink[] = links.map((l) => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
    }));
    linksRef.current = linksCopy;

    zoomG.selectAll('*').remove();

    // Background click-catcher inside zoomG to deselect on empty canvas
    zoomG
      .append('rect')
      .attr('width', width * 6)
      .attr('height', height * 6)
      .attr('x', -width * 2.5)
      .attr('y', -height * 2.5)
      .attr('fill', 'transparent')
      .attr('cursor', 'default')
      .on('click', () => {
        onSelectNode(null);
        setHoveredNode(null);
      });

    // Arrowhead marker definition
    const defs = zoomG.append('defs');
    defs
      .append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--text-muted)')
      .attr('opacity', 0.6);

    // Link elements
    const linkSel = zoomG
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, D3GraphLink>('line')
      .data(linksCopy)
      .enter()
      .append('line')
      .attr('stroke', 'var(--border)')
      .attr('stroke-opacity', visualSettings.linkOpacity || 0.4)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#graph-arrow)');
    linkSelRef.current = linkSel;

    // Node group elements
    const nodeG = zoomG.append('g').attr('class', 'nodes');

    const nodeSel = nodeG
      .selectAll<SVGCircleElement, D3GraphNode>('circle')
      .data(nodesCopy)
      .enter()
      .append('circle')
      .attr('r', (d) => getNodeRadius(d, visualSettings.nodeSize, nodesCopy))
      .attr('fill', (d) => getNodeColor(d, nodesCopy, isDark))
      .attr('stroke', (d) => (d.id === selectedNodeRef.current ? 'var(--accent-start)' : 'var(--card)'))
      .attr('stroke-width', (d) => (d.id === selectedNodeRef.current ? 3 : 1.5))
      .attr('cursor', 'pointer')
      .style('transition', 'fill 0.2s, stroke 0.2s, opacity 0.2s');
    nodeSelRef.current = nodeSel;

    // Labels
    const labelSel = zoomG
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodesCopy)
      .enter()
      .append('text')
      .text((d) => (d.title.length > 18 ? `${d.title.slice(0, 16)}…` : d.title))
      .attr('font-size', 12)
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-primary)')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .style('opacity', visualSettings.showLabels ? 0.9 : 0);

    // Interactivity: hover and click
    nodeSel
      .on('mouseenter', (_event, d) => {
        setHoveredNode(d);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectNode(d.id === selectedNodeRef.current ? null : d.id);
      });

    // Clear hover and selection when clicking or mouse leaving SVG
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        onSelectNode(null);
        setHoveredNode(null);
      }
    });

    svg.on('mouseleave', () => {
      setHoveredNode(null);
    });

    // Layout calculation
    if (visualSettings.layout === 'force-directed') {
      const sim = forceSimulation<D3GraphNode>(nodesCopy)
        .force(
          'link',
          forceLink<D3GraphNode, D3GraphLink>(linksCopy)
            .id((d) => d.id)
            .distance(visualSettings.linkDistance || 120)
        )
        .force(
          'charge',
          forceManyBody<D3GraphNode>().strength(visualSettings.chargeStrength || -300)
        )
        .force('center', forceCenter(width / 2, height / 2))
        .force(
          'collision',
          forceCollide<D3GraphNode>().radius(
            (d) => getNodeRadius(d, visualSettings.nodeSize, nodesCopy) + 6
          )
        )
        .on('tick', () => {
          linkSel
            .attr('x1', (d) => (d.source as D3GraphNode).x ?? 0)
            .attr('y1', (d) => (d.source as D3GraphNode).y ?? 0)
            .attr('x2', (d) => {
              const src = d.source as D3GraphNode;
              const tgt = d.target as D3GraphNode;
              const dx = (tgt.x ?? 0) - (src.x ?? 0);
              const dy = (tgt.y ?? 0) - (src.y ?? 0);
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getNodeRadius(tgt, visualSettings.nodeSize, nodesCopy);
              return dist > 0 ? (tgt.x ?? 0) - (dx / dist) * r : (tgt.x ?? 0);
            })
            .attr('y2', (d) => {
              const src = d.source as D3GraphNode;
              const tgt = d.target as D3GraphNode;
              const dx = (tgt.x ?? 0) - (src.x ?? 0);
              const dy = (tgt.y ?? 0) - (src.y ?? 0);
              const dist = Math.sqrt(dx * dx + dy * dy);
              const r = getNodeRadius(tgt, visualSettings.nodeSize, nodesCopy);
              return dist > 0 ? (tgt.y ?? 0) - (dy / dist) * r : (tgt.y ?? 0);
            });

          nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
          labelSel
            .attr('x', (d) => d.x ?? 0)
            .attr(
              'y',
              (d) => (d.y ?? 0) - getNodeRadius(d, visualSettings.nodeSize, nodesCopy) - 7
            );
        });

      if (!visualSettings.animateOnUpdate) {
        sim.stop();
        for (let i = 0; i < 80; ++i) sim.tick();
        // apply static positions
        linkSel
          .attr('x1', (d) => (d.source as D3GraphNode).x ?? 0)
          .attr('y1', (d) => (d.source as D3GraphNode).y ?? 0)
          .attr('x2', (d) => (d.target as D3GraphNode).x ?? 0)
          .attr('y2', (d) => (d.target as D3GraphNode).y ?? 0);
        nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        labelSel
          .attr('x', (d) => d.x ?? 0)
          .attr('y', (d) => (d.y ?? 0) - getNodeRadius(d, visualSettings.nodeSize, nodesCopy) - 7);
      }

      simRef.current = sim;
    } else {
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }

      const positions =
        visualSettings.layout === 'circular'
          ? computeCircularPositions(nodesCopy, width, height)
          : computeHierarchicalPositions(nodesCopy, width, height);

      nodesCopy.forEach((n, i) => {
        n.x = positions[i]?.x ?? width / 2;
        n.y = positions[i]?.y ?? height / 2;
      });

      linkSel
        .attr('x1', (d) => (d.source as D3GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as D3GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as D3GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as D3GraphNode).y ?? 0);

      nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
      labelSel
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => (d.y ?? 0) - getNodeRadius(d, visualSettings.nodeSize, nodesCopy) - 7);
    }

    return () => {
      if (simRef.current) {
        simRef.current.stop();
      }
    };
  }, [nodes, links, visualSettings, dimensions, onSelectNode, isDark]);

  // Reactive update for theme-aware node colors without rebuilding simulation
  useEffect(() => {
    const nodeSel = nodeSelRef.current;
    if (!nodeSel) return;
    nodeSel.attr('fill', (d) => getNodeColor(d, nodes, isDark));
  }, [isDark, nodes]);

  // Reactive update for highlight & selection without rebuilding simulation
  useEffect(() => {
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    const linksCopy = linksRef.current;
    if (!nodeSel || !linkSel) return;

    const activeTargetId = hoveredNode?.id || selectedNode;
    const activeNeighbours = activeTargetId ? findNeighbours(activeTargetId, linksCopy) : null;

    if (activeTargetId && activeNeighbours) {
      nodeSel
        .attr('opacity', (d) => (d.id === activeTargetId || activeNeighbours.has(d.id) ? 1.0 : 0.25))
        .attr('stroke', (d) => (d.id === selectedNode ? 'var(--accent-start)' : 'var(--card)'))
        .attr('stroke-width', (d) => (d.id === selectedNode ? 3 : 1.5));

      linkSel.attr('stroke-opacity', (d) => {
        const src = (d.source as D3GraphNode).id;
        const tgt = (d.target as D3GraphNode).id;
        return (src === activeTargetId && activeNeighbours.has(tgt)) ||
          (tgt === activeTargetId && activeNeighbours.has(src))
          ? 0.9
          : 0.1;
      });
    } else {
      nodeSel
        .attr('opacity', 1.0)
        .attr('stroke', (d) => (d.id === selectedNode ? 'var(--accent-start)' : 'var(--card)'))
        .attr('stroke-width', (d) => (d.id === selectedNode ? 3 : 1.5));
      linkSel.attr('stroke-opacity', visualSettings.linkOpacity || 0.4);
    }
  }, [selectedNode, hoveredNode, visualSettings.linkOpacity]);

  return {
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
  };
}
