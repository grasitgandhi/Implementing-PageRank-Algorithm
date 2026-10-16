/* ═══════════════════════════════════════════════════
   storage.ts — Typed client for the PageRank Explorer backend API
   Uses relative '/api' which Vite proxies to http://127.0.0.1:5000 in dev.
   Modelled with typed errors (P3) and zero `any` (P7).
   ═══════════════════════════════════════════════════ */

import type {
  PipelineStatus,
  SearchResult,
  Page,
  GraphData,
  PageDetail,
  SearchLogEntry,
  ApiErrorKind,
  ApiErrorPayload,
} from '../types';

const BASE_URL = '/api';

/** Typed API Error class replacing loose Error with magic strings (P3) */
export class ApiError extends Error implements ApiErrorPayload {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Translate raw fetch or parsing exceptions into typed ApiErrors */
export function wrapFetchError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiError('aborted', 'Request was cancelled');
  }
  if (err instanceof TypeError) {
    // Network failures in browser fetch (e.g. backend down / connection refused)
    return new ApiError('offline', 'Backend server is offline or unreachable');
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new ApiError('http', msg);
}

/** Helper to parse JSON responses or throw typed ApiError */
export async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  let data: unknown;
  try {
    data = isJson ? await res.json() : await res.text();
  } catch {
    throw new ApiError('parse', 'Failed to parse server response');
  }

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const errObj = data as { error: unknown };
      if (typeof errObj.error === 'string') {
        errorMsg = errObj.error;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      errorMsg = data;
    }

    if (res.status === 409) {
      throw new ApiError('not_crawled', errorMsg || 'Index has not been crawled yet', 409);
    }
    throw new ApiError('http', errorMsg, res.status);
  }

  return data as T;
}

/** GET /api/status — Check if data is crawled and get live crawl progress */
export async function fetchPipelineStatus(signal?: AbortSignal): Promise<PipelineStatus> {
  try {
    const res = await fetch(`${BASE_URL}/status`, { signal });
    return await handleResponse<PipelineStatus>(res);
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** POST /api/crawl — Start a background crawl job */
export async function startCrawl(
  seeds: string[] | string,
  maxPages: number = 150,
  force: boolean = true,
  signal?: AbortSignal
): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seeds: Array.isArray(seeds) ? seeds : seeds.split(','),
        max_pages: maxPages,
        force,
      }),
      signal,
    });
    return await handleResponse<{ status: string; message: string }>(res);
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** GET /api/search?q=...&alpha=0.5&limit=10 — Query the index */
export async function searchPages(
  query: string,
  alpha: number = 0.5,
  limit: number = 10,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    alpha: alpha.toString(),
    limit: limit.toString(),
  });
  try {
    const res = await fetch(`${BASE_URL}/search?${params.toString()}`, { signal });
    const data = await handleResponse<{ results?: SearchResult[] } | SearchResult[]>(res);
    if (Array.isArray(data)) return data;
    return data.results || [];
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** GET /api/top?n=10 — Top N pages ranked by PageRank */
export async function fetchTopPages(n: number = 10, signal?: AbortSignal): Promise<Page[]> {
  try {
    const res = await fetch(`${BASE_URL}/top?n=${n}`, { signal });
    const data = await handleResponse<{ pages?: Page[]; results?: Page[] } | Page[]>(res);
    if (Array.isArray(data)) return data;
    return data.pages || data.results || [];
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** GET /api/graph?max_nodes=30 — Subgraph for graph visualization */
export async function fetchGraph(maxNodes: number = 30, signal?: AbortSignal): Promise<GraphData> {
  try {
    const res = await fetch(`${BASE_URL}/graph?max_nodes=${maxNodes}`, { signal });
    return await handleResponse<GraphData>(res);
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** GET /api/page/<id> — Full node details including in-links and out-links */
export async function fetchPageDetail(id: string, signal?: AbortSignal): Promise<PageDetail> {
  try {
    const res = await fetch(`${BASE_URL}/page/${encodeURIComponent(id)}`, { signal });
    return await handleResponse<PageDetail>(res);
  } catch (err) {
    throw wrapFetchError(err);
  }
}

/** GET /api/history — Retrieve recent searches */
export async function fetchHistory(signal?: AbortSignal): Promise<SearchLogEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/history`, { signal });
    return await handleResponse<SearchLogEntry[]>(res);
  } catch (err) {
    throw wrapFetchError(err);
  }
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
