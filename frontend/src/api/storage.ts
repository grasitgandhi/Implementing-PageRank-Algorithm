import type { SearchResult } from '../types';

/* ═══════════════════════════════════════════════════
   storage.ts — Async client for the Python Flask bridge
   All calls silently catch errors so the UI never
   breaks when the server is not running.
   ═══════════════════════════════════════════════════ */

const BASE_URL = 'http://localhost:5000/api';

/** Payload sent to /api/search */
interface SearchPayload {
  query: string;
  alpha: number;
  timestamp: string;
  results: SearchResult[];
}

/**
 * Save a search event to searches.json via the Flask bridge.
 * Silently catches errors when the server is offline.
 */
export async function saveSearch(payload: SearchPayload): Promise<void> {
  try {
    await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[storage] saveSearch failed (server offline?):', err);
  }
}

/**
 * Load search history from the Flask bridge.
 * Returns an empty array on failure.
 */
export async function loadSearchHistory(): Promise<SearchPayload[]> {
  try {
    const res = await fetch(`${BASE_URL}/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as SearchPayload[];
  } catch (err) {
    console.warn('[storage] loadSearchHistory failed (server offline?):', err);
    return [];
  }
}
