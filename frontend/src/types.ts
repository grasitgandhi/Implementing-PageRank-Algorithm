/* ═══════════════════════════════════════════════════
   Shared TypeScript interfaces for PageRank Explorer
   Wires the UI to the real Python pipeline API.
   Strict types without `any` (P7, P8 fixes).
   ═══════════════════════════════════════════════════ */

/** A single page in the link graph */
export interface Page {
  id: string;
  title: string;
  url: string;
  relevance?: number; // 0–1: keyword/query relevance
  pagerank: number; // 0–1: PageRank score
  raw_cosine?: number; // raw unscaled cosine similarity (single canonical field, P8)
  inLinks: string[]; // titles/ids of pages linking TO this page
  outLinks: string[]; // titles/ids of pages this page links TO
  rank?: number; // 1-indexed PageRank position
}

/** A directed edge in the link graph */
export interface Link {
  source: string;
  target: string;
}

/** A single search result row from GET /api/search */
export interface SearchResult {
  page_id: string;
  title: string;
  url: string;
  final: number; // formula: final = alpha * relevance + (1 - alpha) * pagerank
  relevance: number; // TF-IDF cosine relevance
  pagerank: number; // normalised PageRank authority
  raw_cosine: number; // unscaled raw cosine similarity
  inLinks: string[];
  outLinks: string[];
  rank: number;
}

/** Crawl status from the server */
export interface CrawlProgress {
  state: 'idle' | 'running' | 'done' | 'error';
  fetched: number;
  max_pages: number;
  current: string;
  error: string | null;
}

/** System pipeline status from GET /api/status */
export interface PipelineStatus {
  crawled: boolean;
  edge_count: number;
  page_count: number;
  crawl: CrawlProgress;
}

/** Graph node from GET /api/graph */
export interface GraphNode {
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

/** Full graph response from GET /api/graph */
export interface GraphData {
  nodes: GraphNode[];
  links: Link[];
  total_pages?: number;
}

/** Detailed page record from GET /api/page/<id> */
export interface PageDetail {
  id: string;
  title: string;
  url: string;
  pagerank: number;
  rank: number;
  inDegree: number;
  outDegree: number;
  inLinks: string[];
  outLinks: string[];
  text?: string;
}

/** Detail view for a selected graph node */
export interface NodeDetails {
  page: Page;
  inDegree: number;
  outDegree: number;
  rank: number;
}

/** Visual settings for the graph panel */
export interface VisualSettings {
  showLabels: boolean;
  nodeSize: 'pagerank' | 'uniform' | 'in-degree';
  layout: 'force-directed' | 'circular' | 'hierarchical';
  animateOnUpdate: boolean;
  colorBy: 'pagerank' | 'relevance' | 'cosine';
  linkOpacity: number; // 0–1
  chargeStrength: number; // d3 force charge (negative)
  linkDistance: number; // d3 force link distance
}

/** Navigation tabs including History panel (B1, B2) */
export type TabId = 'crawl' | 'search' | 'graph' | 'history';

/** Search history record */
export interface SearchLogEntry {
  query: string;
  alpha: number;
  timestamp: string;
  resultsCount?: number;
  results?: SearchResult[]; // Cleanly typed, zero any (P7, P8)
}

/** Derived popular query from history logs (B1) */
export interface PopularQuery {
  query: string;
  count: number;
  lastAlpha: number;
}

/** Typed API error kinds and payload (P3) */
export type ApiErrorKind = 'not_crawled' | 'offline' | 'http' | 'parse' | 'aborted';

export interface ApiErrorPayload {
  kind: ApiErrorKind;
  message: string;
  status?: number;
}

/** Toast notifications (B5) */
export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
