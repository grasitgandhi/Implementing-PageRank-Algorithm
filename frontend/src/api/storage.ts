/* ═══════════════════════════════════════════════════
   API client — typed functions for every backend endpoint.
   Uses relative "/api" so the Vite proxy handles routing.
   ═══════════════════════════════════════════════════ */

import type {
  ApiStatus,
  SearchResult,
  TopPage,
  GraphData,
  PageDetail,
} from '../types';

export type {
  ApiStatus,
  SearchResult,
  TopPage,
  GraphData,
  PageDetail,
};

// ── Fetch helper with error handling ──

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    throw { status: 0, error: 'network_error', message: 'Backend unreachable. Make sure python server.py is running.' };
  }

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    throw { status: res.status, ...body };
  }
  return res.json();
}

// ── Endpoint client functions ──

/** GET /api/status - system status and crawl progress */
export async function fetchStatus(): Promise<ApiStatus> {
  return apiFetch<ApiStatus>('/api/status');
}

/** POST /api/crawl - start background crawl */
export async function startCrawl(
  seeds: string[],
  max_pages: number,
  force: boolean
): Promise<{ status: string; max_pages: number }> {
  return apiFetch('/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seeds, max_pages, force }),
  });
}

/** GET /api/search?q=...&alpha=...&limit=... */
export async function fetchSearchResults(
  q: string,
  alpha: number,
  limit: number = 10
): Promise<{ query: string; alpha: number; results: SearchResult[] }> {
  return apiFetch(`/api/search?q=${encodeURIComponent(q)}&alpha=${alpha}&limit=${limit}`);
}

/** GET /api/top?n=... */
export async function fetchTopPages(
  n: number = 10
): Promise<{ top: TopPage[] }> {
  return apiFetch(`/api/top?n=${n}`);
}

/** GET /api/graph?max_nodes=... */
export async function fetchGraph(
  maxNodes: number = 30
): Promise<GraphData> {
  return apiFetch(`/api/graph?max_nodes=${maxNodes}`);
}

/** GET /api/page/<id> */
export async function fetchPageDetail(
  pageId: string
): Promise<PageDetail> {
  return apiFetch(`/api/page/${encodeURIComponent(pageId)}`);
}

/** POST /api/search-log */
export async function saveSearch(data: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/search-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Ignore logging failures gracefully
  }
}

/** GET /api/history */
export async function fetchHistory(): Promise<unknown[]> {
  return apiFetch('/api/history');
}
