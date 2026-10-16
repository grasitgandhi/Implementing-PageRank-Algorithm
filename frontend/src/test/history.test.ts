import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import * as storage from '../api/storage';
import type { SearchLogEntry } from '../types';

describe('Search history and popular queries (B1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({
      historyEntries: [],
      historyLoading: false,
      historyError: null,
    });
  });

  it('sorts history entries newest first by ISO timestamp', async () => {
    const unorderedEntries: SearchLogEntry[] = [
      {
        query: 'linear algebra',
        alpha: 0.5,
        timestamp: '2026-10-14T10:00:00.000Z', // oldest
        resultsCount: 4,
      },
      {
        query: 'pagerank google',
        alpha: 0.8,
        timestamp: '2026-10-16T12:00:00.000Z', // newest
        resultsCount: 10,
      },
      {
        query: 'markov chains',
        alpha: 0.3,
        timestamp: '2026-10-15T08:00:00.000Z', // middle
        resultsCount: 2,
      },
    ];

    vi.spyOn(storage, 'fetchHistory').mockResolvedValueOnce(unorderedEntries);

    await useAppStore.getState().loadHistory();

    const { historyEntries } = useAppStore.getState();
    expect(historyEntries).toHaveLength(3);
    expect(historyEntries[0].query).toBe('pagerank google');
    expect(historyEntries[1].query).toBe('markov chains');
    expect(historyEntries[2].query).toBe('linear algebra');
  });

  it('aggregates popular queries correctly with case-insensitivity', () => {
    const entries: SearchLogEntry[] = [
      { query: 'PageRank', alpha: 0.5, timestamp: '2026-10-16T10:00:00Z' },
      { query: 'pagerank', alpha: 0.6, timestamp: '2026-10-16T11:00:00Z' },
      { query: 'PAGERANK', alpha: 0.7, timestamp: '2026-10-16T12:00:00Z' },
      { query: 'graph theory', alpha: 0.4, timestamp: '2026-10-16T09:00:00Z' },
      { query: 'graph theory', alpha: 0.5, timestamp: '2026-10-16T13:00:00Z' },
      { query: 'random walk', alpha: 0.2, timestamp: '2026-10-16T14:00:00Z' },
    ];

    useAppStore.setState({ historyEntries: entries });

    const popular = useAppStore.getState().getPopularQueries();

    expect(popular).toHaveLength(3);
    // 'pagerank' was queried 3 times
    expect(popular[0].query.toLowerCase()).toBe('pagerank');
    expect(popular[0].count).toBe(3);

    // 'graph theory' was queried 2 times
    expect(popular[1].query).toBe('graph theory');
    expect(popular[1].count).toBe(2);

    // 'random walk' was queried 1 time
    expect(popular[2].query).toBe('random walk');
    expect(popular[2].count).toBe(1);
  });
});
