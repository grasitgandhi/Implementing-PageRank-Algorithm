import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleResponse,
  wrapFetchError,
  ApiError,
  searchPages,
  fetchTopPages,
} from '../api/storage';
import type { SearchResult, Page } from '../types';

describe('storage.ts — handleResponse and error mapping', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses raw JSON array responses correctly', async () => {
    const mockArray: SearchResult[] = [
      {
        page_id: '1',
        title: 'PageRank Algorithm',
        url: 'https://en.wikipedia.org/wiki/PageRank',
        final: 0.85,
        relevance: 0.9,
        pagerank: 0.8,
        raw_cosine: 0.45,
        inLinks: [],
        outLinks: [],
        rank: 1,
      },
    ];

    const response = new Response(JSON.stringify(mockArray), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed = await handleResponse<SearchResult[]>(response);
    expect(parsed).toEqual(mockArray);
  });

  it('unwraps wrapped object shape in searchPages', async () => {
    const mockResults: SearchResult[] = [
      {
        page_id: '2',
        title: 'Directed Graph',
        url: 'https://en.wikipedia.org/wiki/Directed_graph',
        final: 0.72,
        relevance: 0.7,
        pagerank: 0.74,
        raw_cosine: 0.38,
        inLinks: [],
        outLinks: [],
        rank: 2,
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ results: mockResults }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await searchPages('graph', 0.5);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Directed Graph');
  });

  it('unwraps wrapped pages shape in fetchTopPages', async () => {
    const mockPages: Page[] = [
      {
        id: '1',
        title: 'Linear Algebra',
        url: 'https://en.wikipedia.org/wiki/Linear_algebra',
        pagerank: 0.95,
        raw_cosine: 0.5,
        inLinks: ['a', 'b'],
        outLinks: ['c'],
        rank: 1,
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ pages: mockPages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await fetchTopPages(5);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('1');
  });

  it('maps HTTP 409 to ApiError with kind "not_crawled" (P3)', async () => {
    const make409Response = () =>
      new Response(JSON.stringify({ error: 'Index not crawled yet' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });

    await expect(handleResponse(make409Response())).rejects.toThrow();
    try {
      await handleResponse(make409Response());
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.kind).toBe('not_crawled');
      expect(apiErr.status).toBe(409);
    }
  });

  it('maps HTTP 500 error to ApiError with kind "http"', async () => {
    const response = new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      await handleResponse(response);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.kind).toBe('http');
      expect(apiErr.status).toBe(500);
      expect(apiErr.message).toBe('Internal Server Error');
    }
  });

  it('maps TypeError from fetch failure to kind "offline" (P3)', () => {
    const networkError = new TypeError('Failed to fetch');
    const wrapped = wrapFetchError(networkError);
    expect(wrapped.kind).toBe('offline');
    expect(wrapped.message).toContain('offline or unreachable');
  });

  it('maps DOMException AbortError to kind "aborted" (P2)', () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    const wrapped = wrapFetchError(abortError);
    expect(wrapped.kind).toBe('aborted');
  });
});
