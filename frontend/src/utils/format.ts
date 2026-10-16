import type { SearchResult } from '../types';

/* ═══════════════════════════════════════════════════
   format.ts — Date formatting and export utilities (B1, B7)
   Self-contained, offline-safe, zero external dependencies.
   ═══════════════════════════════════════════════════ */

/** Format an ISO date into a human-friendly relative time string */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const timeMs = date.getTime();
  if (isNaN(timeMs)) return 'Unknown date';

  const now = Date.now();
  const diffSec = Math.floor((now - timeMs) / 1000);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/** Format an exact readable timestamp for tooltips */
export function formatExactTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Client-side CSV export of SearchResult items (B7) */
export function exportResultsAsCSV(results: SearchResult[], query: string): void {
  const headers = ['Rank', 'Title', 'URL', 'Final Score', 'Relevance', 'PageRank', 'Raw Cosine'];
  const rows = results.map((r, idx) => [
    (idx + 1).toString(),
    `"${r.title.replace(/"/g, '""')}"`,
    `"${r.url.replace(/"/g, '""')}"`,
    r.final.toFixed(4),
    r.relevance.toFixed(4),
    r.pagerank.toFixed(4),
    r.raw_cosine.toFixed(4),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeQuery = query.replace(/[^a-z0-9_-]/gi, '_') || 'search_results';
  link.setAttribute('href', url);
  link.setAttribute('download', `pagerank_results_${safeQuery}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Client-side JSON export of SearchResult items (B7) */
export function exportResultsAsJSON(results: SearchResult[], query: string): void {
  const jsonContent = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      query,
      count: results.length,
      results,
    },
    null,
    2
  );
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeQuery = query.replace(/[^a-z0-9_-]/gi, '_') || 'search_results';
  link.setAttribute('href', url);
  link.setAttribute('download', `pagerank_results_${safeQuery}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
