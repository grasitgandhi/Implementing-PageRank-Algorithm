import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

/* ═══════════════════════════════════════════════════
   Graph types — Strict D3 node and link models (zero any)
   ═══════════════════════════════════════════════════ */

export interface D3GraphNode extends SimulationNodeDatum {
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

export interface D3GraphLink extends SimulationLinkDatum<D3GraphNode> {
  source: string | D3GraphNode;
  target: string | D3GraphNode;
}

export interface ResolvedD3GraphLink extends SimulationLinkDatum<D3GraphNode> {
  source: D3GraphNode;
  target: D3GraphNode;
}
