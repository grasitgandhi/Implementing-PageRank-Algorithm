/* ═══════════════════════════════════════════════════
   storage.ts — Typed client for the PageRank Explorer backend API
   Uses relative '/api' which Vite proxies to http://127.0.0.1:5000 in dev.
   ═══════════════════════════════════════════════════ */

import type {
  PipelineStatus,
  SearchResult,
  Page,
  GraphData,
  PageDetail,
  SearchLogEntry,
} from '../types';

const BASE_URL = '/api';

/** Helper to parse JSON responses or throw meaningful error messages */
async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? (data as { error: string }).error
        : typeof data === 'string' && data.length > 0
        ? data
        : `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

/** GET /api/status — Check if data is crawled and get live crawl progress */
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${BASE_URL}/status`);
  return handleResponse<PipelineStatus>(res);
}

/** POST /api/crawl — Start a background crawl job */
export async function startCrawl(
  seeds: string[] | string,
  maxPages: number = 150,
  force: boolean = false
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${BASE_URL}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seeds: Array.isArray(seeds) ? seeds : seeds.split(','),
      max_pages: maxPages,
      force,
    }),
  });
  return handleResponse<{ status: string; message: string }>(res);
}

/** GET /api/search?q=...&alpha=0.5&limit=10 — Query the index */
export async function searchPages(
  query: string,
  alpha: number = 0.5,
  limit: number = 10
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    alpha: alpha.toString(),
    limit: limit.toString(),
  });
  const res = await fetch(`${BASE_URL}/search?${params.toString()}`);
  const data = await handleResponse<{ results?: SearchResult[] } | SearchResult[]>(res);
  if (Array.isArray(data)) return data;
  return data.results || [];
}

/** GET /api/top?n=10 — Top N pages ranked by PageRank */
export async function fetchTopPages(n: number = 10): Promise<Page[]> {
  const res = await fetch(`${BASE_URL}/top?n=${n}`);
  const data = await handleResponse<{ pages?: Page[]; results?: Page[] } | Page[]>(res);
  if (Array.isArray(data)) return data;
  return data.pages || data.results || [];
}

/** GET /api/graph?max_nodes=30 — Subgraph for graph visualization */
export async function fetchGraph(maxNodes: number = 30): Promise<GraphData> {
  const res = await fetch(`${BASE_URL}/graph?max_nodes=${maxNodes}`);
  return handleResponse<GraphData>(res);
}

/** GET /api/page/<id> — Full node details including in-links and out-links */
export async function fetchPageDetail(id: string): Promise<PageDetail> {
  const res = await fetch(`${BASE_URL}/page/${encodeURIComponent(id)}`);
  return handleResponse<PageDetail>(res);
}

/** GET /api/history — Retrieve recent searches */
export async function fetchHistory(): Promise<SearchLogEntry[]> {
  const res = await fetch(`${BASE_URL}/history`);
  return handleResponse<SearchLogEntry[]>(res);
}

/** POST /api/search-log — Log a search to searches.json */
export async function saveSearch(entry: SearchLogEntry): Promise<void> {
  try {
    await fetch(`${BASE_URL}/search-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (err) {
    // History logging failure should not break user search experience
    console.warn('Failed to log search history:', err);
  }
}
