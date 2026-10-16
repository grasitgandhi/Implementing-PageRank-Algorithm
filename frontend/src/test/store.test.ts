import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import * as storage from '../api/storage';
import type { SearchResult } from '../types';

describe('useAppStore — Search behavior and P1-P4 fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(storage, 'saveSearch').mockResolvedValue(undefined);
    vi.spyOn(storage, 'fetchHistory').mockResolvedValue([]);
    useAppStore.setState({
      query: '',
      submittedQuery: '',
      results: [],
      searchLoading: false,
      searchError: null,
      backendOffline: false,
      alpha: 0.5,
      historyEntries: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('P1: debounces alpha changes and does NOT log to search history when sliding alpha', async () => {
    const saveSearchSpy = vi.spyOn(storage, 'saveSearch').mockResolvedValue(undefined);
    const searchPagesSpy = vi.spyOn(storage, 'searchPages').mockResolvedValue([
      {
        page_id: '1',
        title: 'Wikipedia',
        url: 'https://en.wikipedia.org',
        final: 0.9,
        relevance: 0.8,
        pagerank: 0.95,
        raw_cosine: 0.6,
        inLinks: [],
        outLinks: [],
        rank: 1,
      },
    ]);

    // First do an explicit search
    useAppStore.setState({ submittedQuery: 'algorithm' });

    // Rapidly change alpha 5 times (simulating a slider drag)
    useAppStore.getState().setAlpha(0.2);
    useAppStore.getState().setAlpha(0.3);
    useAppStore.getState().setAlpha(0.4);
    useAppStore.getState().setAlpha(0.6);
    useAppStore.getState().setAlpha(0.7);

    // Fast-forward past debounce timer (300ms)
    vi.advanceTimersByTime(350);
    await Promise.resolve(); // flush microtasks

    // searchPages should have been called only ONCE for the debounced final value 0.7
    expect(searchPagesSpy).toHaveBeenCalledTimes(1);
    expect(searchPagesSpy).toHaveBeenCalledWith('algorithm', 0.7, 10, expect.any(AbortSignal));

    // P1 PROOF: saveSearch was NOT called at all during alpha sliding!
    expect(saveSearchSpy).not.toHaveBeenCalled();
  });

  it('P1: logs to search history ONLY on explicit submission', async () => {
    const saveSearchSpy = vi.spyOn(storage, 'saveSearch').mockResolvedValue(undefined);
    vi.spyOn(storage, 'searchPages').mockResolvedValue([]);

    // Explicit submission (isExplicitSubmit = true)
    await useAppStore.getState().performSearch('graph theory', 0.6, true);

    expect(saveSearchSpy).toHaveBeenCalledTimes(1);
    expect(saveSearchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'graph theory',
        alpha: 0.6,
      })
    );
  });

  it('P2: guarantees latest-response-wins when out-of-order responses arrive', async () => {
    let resolveFirst: (results: SearchResult[]) => void;
    const firstPromise = new Promise<SearchResult[]>((resolve) => {
      resolveFirst = resolve;
    });

    const secondResults: SearchResult[] = [
      {
        page_id: 'fast',
        title: 'Fast Result',
        url: 'https://example.com/fast',
        final: 1.0,
        relevance: 1.0,
        pagerank: 1.0,
        raw_cosine: 1.0,
        inLinks: [],
        outLinks: [],
        rank: 1,
      },
    ];

    const firstResults: SearchResult[] = [
      {
        page_id: 'slow',
        title: 'Slow Result',
        url: 'https://example.com/slow',
        final: 0.5,
        relevance: 0.5,
        pagerank: 0.5,
        raw_cosine: 0.5,
        inLinks: [],
        outLinks: [],
        rank: 2,
      },
    ];

    // Mock searchPages: call 1 returns slow firstPromise, call 2 returns fast secondResults
    vi.spyOn(storage, 'searchPages')
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(async () => secondResults);

    // Launch request 1 (slow)
    const p1 = useAppStore.getState().performSearch('slow query', 0.5);

    // Launch request 2 (fast) immediately after
    const p2 = useAppStore.getState().performSearch('fast query', 0.5);

    // Request 2 completes first
    await p2;
    expect(useAppStore.getState().submittedQuery).toBe('fast query');
    expect(useAppStore.getState().results[0].page_id).toBe('fast');

    // Request 1 completes later (stale response)
    resolveFirst!(firstResults);
    await p1;

    // State MUST STILL have request 2's results, not overwritten by stale request 1
    expect(useAppStore.getState().submittedQuery).toBe('fast query');
    expect(useAppStore.getState().results[0].page_id).toBe('fast');
  });

  it('P3 & P4: handles 409 not_crawled error and does NOT set submittedQuery on failure', async () => {
    vi.spyOn(storage, 'searchPages').mockRejectedValueOnce(
      new storage.ApiError('not_crawled', 'No pages crawled yet', 409)
    );

    await useAppStore.getState().performSearch('test fail query', 0.5, true);

    const state = useAppStore.getState();
    // P4: submittedQuery must NOT be set to the failed query
    expect(state.submittedQuery).toBe('');
    // P3: searchError must be typed with kind "not_crawled"
    expect(state.searchError?.kind).toBe('not_crawled');
    expect(state.results).toHaveLength(0);
  });

  it('P3: detects offline backend and marks backendOffline', async () => {
    vi.spyOn(storage, 'searchPages').mockRejectedValueOnce(
      new storage.ApiError('offline', 'Backend is unreachable')
    );

    await useAppStore.getState().performSearch('connectivity test', 0.5, true);

    const state = useAppStore.getState();
    expect(state.backendOffline).toBe(true);
    expect(state.searchError?.kind).toBe('offline');
  });
});
