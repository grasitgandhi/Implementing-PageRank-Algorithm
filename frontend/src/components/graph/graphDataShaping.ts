import type { D3GraphNode, D3GraphLink } from './types';

/* ═══════════════════════════════════════════════════
   graphDataShaping.ts — Pure mathematical data shaping
   Extracts layout coordinate computation, sizing scales,
   color tiering, and network topology analysis from UI rendering.
   ═══════════════════════════════════════════════════ */

/** Color tiering based on global PageRank position — theme-aware */
export function getNodeColor(
  node: D3GraphNode,
  sortedNodes: D3GraphNode[],
  isDark: boolean = false
): string {
  const idx = sortedNodes.findIndex((p) => p.id === node.id);
  if (isDark) {
    if (idx < 3) return '#f97316'; // Orange — Tier 1 authority
    if (idx < 7) return '#ec4899'; // Pink — Tier 2 authority
    return '#6b7280';              // Slate Gray — Tier 3 baseline
  } else {
    if (idx < 3) return '#9b8fe8'; // Medium Lavender — Top 3 authority
    if (idx < 7) return '#c4b5fd'; // Soft Violet — Mid Tier
    return '#94a3b8';              // Slate — Low Tier
  }
}

/** Calculate node radius depending on selected sizing metric */
export function getNodeRadius(
  node: D3GraphNode,
  metric: 'pagerank' | 'uniform' | 'in-degree',
  nodes: D3GraphNode[]
): number {
  const min = 8;
  const max = 26;

  if (metric === 'uniform' || nodes.length === 0) {
    return 14;
  }

  if (metric === 'pagerank') {
    const prs = nodes.map((p) => p.pagerank);
    const maxPR = Math.max(...prs);
    const minPR = Math.min(...prs);
    if (maxPR === minPR) return (min + max) / 2;
    return min + ((node.pagerank - minPR) / (maxPR - minPR)) * (max - min);
  }

  // in-degree
  const degs = nodes.map((p) => p.inDegree);
  const maxDeg = Math.max(...degs);
  const minDeg = Math.min(...degs);
  if (maxDeg === minDeg) return (min + max) / 2;
  return min + ((node.inDegree - minDeg) / (maxDeg - minDeg)) * (max - min);
}

/** Compute circular perimeter positions for circular layout */
export function computeCircularPositions(
  nodes: D3GraphNode[],
  width: number,
  height: number
): { x: number; y: number }[] {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const count = nodes.length;

  return nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / (count || 1) - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

/** Compute tiered hierarchical positions by rank */
export function computeHierarchicalPositions(
  nodes: D3GraphNode[],
  width: number,
  height: number
): { x: number; y: number }[] {
  const paddingX = 60;
  const paddingY = 50;
  const usableW = Math.max(width - paddingX * 2, 200);
  const usableH = Math.max(height - paddingY * 2, 200);

  // Group nodes into 3 tiers by rank
  const tier1 = nodes.filter((_, i) => i < 3);
  const tier2 = nodes.filter((_, i) => i >= 3 && i < 10);
  const tier3 = nodes.filter((_, i) => i >= 10);

  const tiers = [tier1, tier2, tier3].filter((t) => t.length > 0);
  const tierSpacing = usableH / Math.max(tiers.length - 1, 1);

  const result: { x: number; y: number }[] = new Array(nodes.length);

  tiers.forEach((tier, tierIdx) => {
    const y = paddingY + tierIdx * tierSpacing;
    const colSpacing = usableW / Math.max(tier.length + 1, 2);
    tier.forEach((node, colIdx) => {
      const globalIdx = nodes.findIndex((n) => n.id === node.id);
      result[globalIdx] = {
        x: paddingX + (colIdx + 1) * colSpacing,
        y,
      };
    });
  });

  return result;
}

/** Find all directly adjacent neighbours of a given node in the graph */
export function findNeighbours(nodeId: string, links: D3GraphLink[]): Set<string> {
  const neighbours = new Set<string>();
  for (const link of links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (src === nodeId) neighbours.add(tgt);
    if (tgt === nodeId) neighbours.add(src);
  }
  return neighbours;
}
