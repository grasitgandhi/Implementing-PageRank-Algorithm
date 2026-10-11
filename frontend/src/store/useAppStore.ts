import { create } from 'zustand';
import type {
  TabId,
  VisualSettings,
  SearchResult,
  TopPage,
  GraphData,
  PageDetail,
  ApiStatus,
} from '../types';
import {
  fetchStatus,
  fetchSearchResults,
  fetchTopPages,
  fetchGraph,
  fetchPageDetail,
  startCrawl,
  saveSearch,
} from '../api/storage';

/* ═══════════════════════════════════════════════════
   Global application state (Zustand)
   Real API state replacing all mock data
   ═══════════════════════════════════════════════════ */

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

  // Backend status
  status: ApiStatus | null;
  statusLoading: boolean;
  isBackendOffline: boolean;
  checkStatus: () => Promise<ApiStatus | null>;

  // Search
  query: string;
  setQuery: (query: string) => void;
  // Blend factor: final = alpha * relevance + (1 - alpha) * pagerank
  alpha: number;
  setAlpha: (alpha: number) => void;
  results: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  searchExecuted: boolean;
  performSearch: () => Promise<void>;

  // Display toggles
  showBreakdown: boolean;
  setShowBreakdown: (show: boolean) => void;
  showCosine: boolean;
  setShowCosine: (show: boolean) => void;

  // Top Pages
  topPages: TopPage[];
  topPagesLoading: boolean;
  topPagesError: string | null;
  loadTopPages: (n?: number) => Promise<void>;

  // Graph
  graphData: GraphData | null;
  graphLoading: boolean;
  graphError: string | null;
  loadGraph: (maxNodes?: number) => Promise<void>;

  // Graph selection & details
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  selectedNodeDetail: PageDetail | null;
  loadNodeDetail: (nodeId: string) => Promise<void>;

  // Visual settings for graph
  visualSettings: VisualSettings;
  setVisualSettings: (settings: Partial<VisualSettings>) => void;

  // Crawl management
  crawlLoading: boolean;
  crawlError: string | null;
  triggerCrawl: (seeds: string[], maxPages: number, force: boolean) => Promise<boolean>;
  refreshAllData: () => Promise<void>;
}

/** Determine initial theme from localStorage or system preference */
function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('pagerank-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'search',
  setTab: (tab) => set({ activeTab: tab }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

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

  // Backend status
  status: null,
  statusLoading: false,
  isBackendOffline: false,
  checkStatus: async () => {
    set({ statusLoading: true });
    try {
      const status = await fetchStatus();
      set({ status, isBackendOffline: false, statusLoading: false });
      return status;
    } catch (err: any) {
      const isOffline = err?.status === 0 || err?.error === 'network_error';
      set({ isBackendOffline: isOffline, statusLoading: false });
      return null;
    }
  },

  // Search state
  query: '',
  setQuery: (query) => set({ query }),
  alpha: 0.5,
  setAlpha: (alpha) => set({ alpha }),
  results: [],
  searchLoading: false,
  searchError: null,
  searchExecuted: false,

  performSearch: async () => {
    const { query, alpha } = get();
    if (!query.trim()) {
      set({ results: [], searchExecuted: false, searchError: null });
      return;
    }

    set({ searchLoading: true, searchError: null });
    try {
      const res = await fetchSearchResults(query, alpha, 10);
      set({
        results: res.results || [],
        searchLoading: false,
        searchExecuted: true,
        isBackendOffline: false,
      });

      // Fire-and-forget log search
      saveSearch({
        query,
        alpha,
        timestamp: new Date().toISOString(),
        result_count: res.results?.length || 0,
      });
    } catch (err: any) {
      if (err?.status === 0 || err?.error === 'network_error') {
        set({
          searchLoading: false,
          isBackendOffline: true,
          searchError: 'Backend server is offline. Please run python server.py.',
        });
      } else if (err?.status === 409 || err?.error === 'not_crawled') {
        set({
          searchLoading: false,
          searchError: 'No crawled data available. Run a crawl first.',
        });
      } else {
        set({
          searchLoading: false,
          searchError: err?.message || err?.error || 'Failed to perform search',
        });
      }
    }
  },

  // Display toggles
  showBreakdown: true,
  setShowBreakdown: (showBreakdown) => set({ showBreakdown }),
  showCosine: false,
  setShowCosine: (showCosine) => set({ showCosine }),

  // Top pages
  topPages: [],
  topPagesLoading: false,
  topPagesError: null,
  loadTopPages: async (n = 10) => {
    set({ topPagesLoading: true, topPagesError: null });
    try {
      const res = await fetchTopPages(n);
      set({ topPages: res.top || [], topPagesLoading: false, isBackendOffline: false });
    } catch (err: any) {
      const isOffline = err?.status === 0 || err?.error === 'network_error';
      set({
        topPagesLoading: false,
        isBackendOffline: isOffline,
        topPagesError: err?.status === 409 ? 'Not crawled yet' : (err?.message || 'Failed to load top pages'),
      });
    }
  },

  // Graph
  graphData: null,
  graphLoading: false,
  graphError: null,
  loadGraph: async (maxNodes = 30) => {
    set({ graphLoading: true, graphError: null });
    try {
      const res = await fetchGraph(maxNodes);
      set({ graphData: res, graphLoading: false, isBackendOffline: false });
    } catch (err: any) {
      const isOffline = err?.status === 0 || err?.error === 'network_error';
      set({
        graphLoading: false,
        isBackendOffline: isOffline,
        graphError: err?.status === 409 ? 'Not crawled yet' : (err?.message || 'Failed to load graph'),
      });
    }
  },

  // Selection
  selectedNode: null,
  selectedNodeDetail: null,
  setSelectedNode: (selectedNode) => {
    set({ selectedNode });
    if (selectedNode) {
      get().loadNodeDetail(selectedNode);
    } else {
      set({ selectedNodeDetail: null });
    }
  },
  loadNodeDetail: async (nodeId: string) => {
    try {
      const detail = await fetchPageDetail(nodeId);
      set({ selectedNodeDetail: detail });
    } catch {
      // Fallback: construct partial detail from graphData or topPages or results
      const { graphData, topPages, results } = get();
      const node = graphData?.nodes.find((n) => n.id === nodeId);
      const top = topPages.find((p) => p.page_id === nodeId);
      const res = results.find((r) => r.page_id === nodeId);
      if (node || top || res) {
        set({
          selectedNodeDetail: {
            page_id: nodeId,
            title: node?.title || top?.title || res?.title || nodeId.replace(/_/g, ' '),
            url: `https://en.wikipedia.org/wiki/${nodeId}`,
            pagerank: node?.pagerank ?? top?.pagerank ?? res?.pagerank ?? 0,
            rank: node?.rank ?? top?.rank ?? res?.rank ?? 0,
            inLinks: node?.inLinks || top?.inLinks || res?.inLinks || [],
            outLinks: node?.outLinks || top?.outLinks || res?.outLinks || [],
            inDegree: (node?.inLinks || top?.inLinks || res?.inLinks || []).length,
            outDegree: (node?.outLinks || top?.outLinks || res?.outLinks || []).length,
          },
        });
      }
    }
  },

  visualSettings: defaultVisualSettings,
  setVisualSettings: (partial) =>
    set((state) => ({
      visualSettings: { ...state.visualSettings, ...partial },
    })),

  // Crawl management
  crawlLoading: false,
  crawlError: null,
  triggerCrawl: async (seeds, maxPages, force) => {
    set({ crawlLoading: true, crawlError: null });
    try {
      await startCrawl(seeds, maxPages, force);
      set({ crawlLoading: false });
      await get().checkStatus();
      return true;
    } catch (err: any) {
      set({
        crawlLoading: false,
        crawlError: err?.message || err?.error || 'Failed to start crawl',
      });
      return false;
    }
  },

  refreshAllData: async () => {
    await get().checkStatus();
    await Promise.all([
      get().loadTopPages(10),
      get().loadGraph(30),
    ]);
  },
}));
