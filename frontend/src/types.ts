/* ═══════════════════════════════════════════════════
   Shared TypeScript interfaces for PageRank Explorer
   Parts 2 and 3 will import these types.
   ═══════════════════════════════════════════════════ */

/** A single page in the graph */
export interface Page {
  id: string;
  title: string;
  url: string;
  relevance: number;   // 0–1: keyword/query relevance
  pagerank: number;     // 0–1: PageRank score
  cosine: number;       // 0–1: cosine similarity to query
  inLinks: string[];    // titles of pages linking TO this page
  outLinks: string[];   // titles of pages this page links TO
}

/** A directed edge in the link graph */
export interface Link {
  source: string;
  target: string;
}

/** A single search result row (query + combined score) */
export interface SearchResult {
  page: Page;
  combinedScore: number;  // alpha * pagerank + (1 - alpha) * relevance
}

/** Detail view for a selected graph node */
export interface NodeDetails {
  page: Page;
  inDegree: number;
  outDegree: number;
  rank: number;           // 1-indexed position among all pages
}

/** Visual settings for the graph panel */
export interface VisualSettings {
  showLabels: boolean;
  nodeSize: 'pagerank' | 'uniform' | 'in-degree';
  layout: 'force-directed' | 'circular' | 'hierarchical';
  animateOnUpdate: boolean;
  colorBy: 'pagerank' | 'relevance' | 'cosine';
  linkOpacity: number;    // 0–1
  chargeStrength: number; // d3 force charge (negative)
  linkDistance: number;    // d3 force link distance
}

/** Navigation tabs */
export type TabId = 'search' | 'top-pages' | 'graph' | 'about';
