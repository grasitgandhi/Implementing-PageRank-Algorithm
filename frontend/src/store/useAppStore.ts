import { create } from 'zustand';
import type {
  TabId,
  VisualSettings,
  PipelineStatus,
  SearchResult,
  Page,
  GraphData,
  PageDetail,
  SearchLogEntry,
  ApiErrorPayload,
  ToastItem,
  PopularQuery,
} from '../types';
import {
  fetchPipelineStatus,
  searchPages,
  fetchTopPages,
  fetchGraph,
  fetchPageDetail,
  fetchHistory,
  saveSearch,
  ApiError,
} from '../api/storage';

/* ═══════════════════════════════════════════════════
   Global application state (Zustand)
   Wires all UI panels to the real Python pipeline.
   Strictly typed with zero `any`, debounced alpha (P1),
   latest-request-wins (P2), typed errors (P3),
   and submittedQuery on success (P4).
   ═══════════════════════════════════════════════════ */

/** Debounce interval for re-ranking when sliding the alpha control.
 * 300ms provides instant responsiveness without overloading the Python server. */
export const ALPHA_DEBOUNCE_MS = 300;

/** Default number of top pages to fetch */
export const DEFAULT_TOP_PAGES_COUNT = 10;

/** Default max nodes for graph visualization */
export const DEFAULT_GRAPH_MAX_NODES = 30;

/** Auto-dismiss duration for toasts in milliseconds */
export const TOAST_DURATION_MS = 4000;

interface AppState {
  // Navigation
  activeTab: TabId;
  setTab: (tab: TabId) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Toasts (B5)
  toasts: ToastItem[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;

  // System Pipeline & Backend Status
  pipelineStatus: PipelineStatus | null;
  backendOffline: boolean;
  statusLoading: boolean;
  refreshStatus: () => Promise<void>;

  // Search parameters & results
  query: string;
  setQuery: (query: string) => void;
  submittedQuery: string;
  setSubmittedQuery: (submittedQuery: string) => void;
  alpha: number; // blend factor: final = alpha * relevance + (1 - alpha) * pagerank
  setAlpha: (alpha: number) => void;
  results: SearchResult[];
  searchLoading: boolean;
  searchError: ApiErrorPayload | null;
  performSearch: (query?: string, alphaVal?: number, isExplicitSubmit?: boolean) => Promise<void>;

  // Display toggles
  showBreakdown: boolean;
  setShowBreakdown: (show: boolean) => void;
  showCosine: boolean;
  setShowCosine: (show: boolean) => void;

  // Top Pages
  topPages: Page[];
  topPagesLoading: boolean;
  topPagesError: ApiErrorPayload | null;
  loadTopPages: (n?: number) => Promise<void>;

  // Link Graph
  graphData: GraphData | null;
  graphLoading: boolean;
  graphError: ApiErrorPayload | null;
  loadGraph: (maxNodes?: number) => Promise<void>;

  // Node Selection & Details
  selectedNode: string | null;
  selectedPageDetail: PageDetail | null;
  selectedPageLoading: boolean;
  selectedPageError: ApiErrorPayload | null;
  setSelectedNode: (nodeId: string | null) => void;
  loadPageDetail: (nodeId: string) => Promise<void>;

  // History Panel & Popular Searches (B1)
  historyEntries: SearchLogEntry[];
  historyLoading: boolean;
  historyError: ApiErrorPayload | null;
  loadHistory: () => Promise<void>;
  getPopularQueries: () => PopularQuery[];

  // Visual settings for graph
  visualSettings: VisualSettings;
  setVisualSettings: (settings: Partial<VisualSettings>) => void;
}

/** Determine initial theme from localStorage or system preference */
function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('pagerank-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

/** Safely read UI preference from localStorage with prefix pagerank-ui- (B9) */
function getStoredPreference<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(`pagerank-ui-${key}`);
    if (item === null) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

/** Safely save UI preference into localStorage with prefix pagerank-ui- (B9) */
function setStoredPreference<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`pagerank-ui-${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage quota or disabled issues
  }
}

const defaultVisualSettings: VisualSettings = {
  showLabels: true,
  nodeSize: 'pagerank',
  layout: 'force-directed',
  animateOnUpdate: true,
  colorBy: 'pagerank',
  linkOpacity: 0.4,
  chargeStrength: -300,
  linkDistance: 120,
};

// Module-level abort controllers and sequence counters for latest-wins (P2)
let searchAbortController: AbortController | null = null;
let searchSequenceId = 0;
let alphaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeTab: (() => {
    const tab = getStoredPreference<string>('tab', 'search');
    return tab === 'crawl' || tab === 'search' || tab === 'graph' || tab === 'history'
      ? (tab as TabId)
      : 'search';
  })(),
  setTab: (tab) => {
    setStoredPreference('tab', tab);
    set({ activeTab: tab });
  },

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Theme
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('pagerank-theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    set({ theme });
  },

  // Toasts
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, TOAST_DURATION_MS);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  // Pipeline status
  pipelineStatus: null,
  backendOffline: false,
  statusLoading: false,
  refreshStatus: async () => {
    set({ statusLoading: true });
    try {
      const status = await fetchPipelineStatus();
      set({ pipelineStatus: status, backendOffline: false, statusLoading: false });
    } catch (err) {
      const apiErr =
        err instanceof ApiError ? err : new ApiError('offline', 'Backend is unreachable');
      set({
        pipelineStatus: null,
        backendOffline: apiErr.kind === 'offline',
        statusLoading: false,
      });
    }
  },

  // Search
  query: '',
  setQuery: (query) => set({ query }),
  submittedQuery: '',
  setSubmittedQuery: (submittedQuery) => set({ submittedQuery }),
  alpha: getStoredPreference<number>('alpha', 0.5),

  setAlpha: (alpha) => {
    set({ alpha });
    setStoredPreference('alpha', alpha);

    // P1: Debounce slider changes and re-rank WITHOUT logging to search history
    const { submittedQuery, performSearch } = get();
    if (submittedQuery.trim()) {
      if (alphaDebounceTimer !== null) {
        clearTimeout(alphaDebounceTimer);
      }
      alphaDebounceTimer = setTimeout(() => {
        // isExplicitSubmit is false so slider adjustments NEVER spam the history log
        performSearch(submittedQuery, alpha, false);
      }, ALPHA_DEBOUNCE_MS);
    }
  },

  results: [],
  searchLoading: false,
  searchError: null,

  performSearch: async (qParam?: string, alphaParam?: number, isExplicitSubmit: boolean = true) => {
    const q = (qParam !== undefined ? qParam : get().query).trim();
    const a = alphaParam !== undefined ? alphaParam : get().alpha;

    if (!q) {
      set({ results: [], submittedQuery: '', searchError: null, searchLoading: false });
      return;
    }

    // Cancel pending alpha debounces if user explicitly triggered search
    if (isExplicitSubmit && alphaDebounceTimer !== null) {
      clearTimeout(alphaDebounceTimer);
      alphaDebounceTimer = null;
    }

    // P2: Cancel any existing in-flight search request (latest-request-wins)
    if (searchAbortController) {
      searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    const currentSignal = searchAbortController.signal;
    const currentRequestId = ++searchSequenceId;

    set({ searchLoading: true, searchError: null });

    try {
      const results = await searchPages(q, a, 10, currentSignal);

      // If another search started in the meantime, ignore this stale response
      if (currentRequestId !== searchSequenceId) {
        return;
      }

      // P4: Set submittedQuery ONLY after the request succeeds
      set({
        results,
        submittedQuery: q,
        searchLoading: false,
        searchError: null,
        backendOffline: false,
      });

      // P1: Log to search history ONLY on explicit submission (button, Enter, history click)
      if (isExplicitSubmit) {
        saveSearch({
          query: q,
          alpha: a,
          timestamp: new Date().toISOString(),
          resultsCount: results.length,
          results,
        });
        // Silently refresh history after a newly logged search
        get().loadHistory();
      }
    } catch (err) {
      // If aborted because a newer search was started, do not touch state
      if (err instanceof ApiError && err.kind === 'aborted') {
        return;
      }
      if (currentRequestId !== searchSequenceId) {
        return;
      }

      const apiErr: ApiErrorPayload =
        err instanceof ApiError
          ? { kind: err.kind, message: err.message, status: err.status }
          : { kind: 'http', message: err instanceof Error ? err.message : 'Search failed' };

      // P4: On failure, submittedQuery is NOT set to the failing query
      set({
        results: [],
        searchLoading: false,
        searchError: apiErr,
        backendOffline: apiErr.kind === 'offline',
      });
      get().addToast('error', `Search failed: ${apiErr.message}`);
    }
  },

  // Display toggles
  showBreakdown: getStoredPreference<boolean>('showBreakdown', true),
  setShowBreakdown: (showBreakdown) => {
    setStoredPreference('showBreakdown', showBreakdown);
    set({ showBreakdown });
  },
  showCosine: getStoredPreference<boolean>('showCosine', false),
  setShowCosine: (showCosine) => {
    setStoredPreference('showCosine', showCosine);
    set({ showCosine });
  },

  // Top Pages
  topPages: [],
  topPagesLoading: false,
  topPagesError: null,
  loadTopPages: async (n = DEFAULT_TOP_PAGES_COUNT) => {
    set({ topPagesLoading: true, topPagesError: null });
    try {
      const pages = await fetchTopPages(n);
      set({ topPages: pages, topPagesLoading: false, topPagesError: null, backendOffline: false });
    } catch (err) {
      const apiErr: ApiErrorPayload =
        err instanceof ApiError
          ? { kind: err.kind, message: err.message, status: err.status }
          : {
              kind: 'http',
              message: err instanceof Error ? err.message : 'Failed to fetch top pages',
            };
      set({
        topPages: [],
        topPagesLoading: false,
        topPagesError: apiErr,
        backendOffline: apiErr.kind === 'offline',
      });
    }
  },

  // Graph Data
  graphData: null,
  graphLoading: false,
  graphError: null,
  loadGraph: async (maxNodes = DEFAULT_GRAPH_MAX_NODES) => {
    set({ graphLoading: true, graphError: null });
    try {
      const data = await fetchGraph(maxNodes);
      set({ graphData: data, graphLoading: false, graphError: null, backendOffline: false });
    } catch (err) {
      const apiErr: ApiErrorPayload =
        err instanceof ApiError
          ? { kind: err.kind, message: err.message, status: err.status }
          : { kind: 'http', message: err instanceof Error ? err.message : 'Failed to fetch graph' };
      set({
        graphData: null,
        graphLoading: false,
        graphError: apiErr,
        backendOffline: apiErr.kind === 'offline',
      });
    }
  },

  // Node selection & detail
  selectedNode: null,
  selectedPageDetail: null,
  selectedPageLoading: false,
  selectedPageError: null,
  setSelectedNode: (nodeId) => {
    set({ selectedNode: nodeId });
    if (nodeId) {
      get().loadPageDetail(nodeId);
    } else {
      set({ selectedPageDetail: null, selectedPageError: null });
    }
  },
  loadPageDetail: async (nodeId: string) => {
    set({ selectedPageLoading: true, selectedPageError: null });
    try {
      const detail = await fetchPageDetail(nodeId);
      set({ selectedPageDetail: detail, selectedPageLoading: false, selectedPageError: null });
    } catch (err) {
      const apiErr: ApiErrorPayload =
        err instanceof ApiError
          ? { kind: err.kind, message: err.message, status: err.status }
          : {
              kind: 'http',
              message: err instanceof Error ? err.message : 'Failed to load page detail',
            };
      set({
        selectedPageDetail: null,
        selectedPageLoading: false,
        selectedPageError: apiErr,
      });
    }
  },

  // History Panel & Popular Queries (B1)
  historyEntries: [],
  historyLoading: false,
  historyError: null,
  loadHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const rawEntries = await fetchHistory();
      // Client-side sort: newest first by timestamp (do not trust server order)
      const sorted = [...rawEntries].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      set({
        historyEntries: sorted,
        historyLoading: false,
        historyError: null,
        backendOffline: false,
      });
    } catch (err) {
      const apiErr: ApiErrorPayload =
        err instanceof ApiError
          ? { kind: err.kind, message: err.message, status: err.status }
          : {
              kind: 'http',
              message: err instanceof Error ? err.message : 'Failed to fetch history',
            };
      set({
        historyEntries: [],
        historyLoading: false,
        historyError: apiErr,
        backendOffline: apiErr.kind === 'offline',
      });
    }
  },

  getPopularQueries: () => {
    const { historyEntries } = get();
    if (!historyEntries.length) return [];

    const map = new Map<string, { count: number; lastAlpha: number; displayQuery: string }>();

    for (const entry of historyEntries) {
      const key = entry.query.trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          count: 1,
          lastAlpha: entry.alpha,
          displayQuery: entry.query.trim(),
        });
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        query: item.displayQuery,
        count: item.count,
        lastAlpha: item.lastAlpha,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 popular searches
  },

  // Visual settings
  visualSettings: getStoredPreference<VisualSettings>('visual-settings', defaultVisualSettings),
  setVisualSettings: (partial) =>
    set((state) => {
      const updated = { ...state.visualSettings, ...partial };
      setStoredPreference('visual-settings', updated);
      return { visualSettings: updated };
    }),
}));
