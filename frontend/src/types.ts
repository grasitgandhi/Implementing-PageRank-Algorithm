/* ═══════════════════════════════════════════════════
   Shared TypeScript interfaces for PageRank Explorer
   ═══════════════════════════════════════════════════ */

/** A single page in the graph / search results */
export interface Page {
  id: string;
  title: string;
  url: string;
  relevance: number;   // 0–1: keyword/query relevance
  pagerank: number;    // 0–1: PageRank score
  cosine: number;      // 0–1: cosine similarity to query
  inLinks: string[];   // IDs of pages linking TO this page
  outLinks: string[];  // IDs of pages this page links TO
  rank?: number;
}

/** A directed edge in the link graph */
export interface Link {
  source: string;
  target: string;
}

/** A single search result row from the real backend pipeline */
export interface SearchResult {
  page_id: string;
  title: string;
  url: string;
  final: number;       // final = alpha * relevance + (1 - alpha) * pagerank
  relevance: number;   // raw cosine similarity normalized against query
  pagerank: number;    // normalized PageRank score
  cosine: number;      // raw cosine similarity
  inLinks: string[];
  outLinks: string[];
  rank: number;        // global PageRank rank
}

/** Top page entry by PageRank */
export interface TopPage {
  page_id: string;
  title: string;
  url: string;
  pagerank: number;
  rank: number;
  inLinks: string[];
  outLinks: string[];
}

/** Node for graph visualization */
export interface GraphNode {
  id: string;
  title: string;
  pagerank: number;
  rank: number;
  inLinks: string[];
  outLinks: string[];
}

/** Link for graph visualization */
export interface GraphLink {
  source: string;
  target: string;
}

/** Graph snapshot dataset */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Detailed view for a single page */
export interface PageDetail {
  page_id: string;
  title: string;
  url: string;
  pagerank: number;
  rank: number;
  inLinks: string[];
  outLinks: string[];
  inDegree: number;
  outDegree: number;
}

/** Progress and state of a crawl job */
export interface CrawlStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  fetched: number;
  max_pages: number;
  current: string;
  error: string;
}

/** Server status response */
export interface ApiStatus {
  crawled: boolean;
  edge_count: number;
  page_count: number;
  crawl: CrawlStatus;
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
  linkDistance: number;   // d3 force link distance
}

/** Navigation tabs */
export type TabId = 'crawl' | 'search' | 'top-pages' | 'graph';
