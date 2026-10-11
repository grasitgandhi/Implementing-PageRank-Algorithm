import { create } from 'zustand';
import type {
  TabId,
  VisualSettings,
  PipelineStatus,
  SearchResult,
  Page,
  GraphData,
  PageDetail,
} from '../types';
import {
  fetchPipelineStatus,
  searchPages,
  fetchTopPages,
  fetchGraph,
  fetchPageDetail,
  saveSearch,
} from '../api/storage';

/* ═══════════════════════════════════════════════════
   Global application state (Zustand)
   Wires all UI panels to the real Python pipeline
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

  // System Pipeline & Backend Status
  pipelineStatus: PipelineStatus | null;
  backendOffline: boolean;
  refreshStatus: () => Promise<void>;

  // Search parameters & results
  query: string;
  setQuery: (query: string) => void;
  submittedQuery: string;
  setSubmittedQuery: (query: string) => void;
  alpha: number;             // blend factor: final = alpha * relevance + (1 - alpha) * pagerank
  setAlpha: (alpha: number) => void;
  results: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  performSearch: (query?: string, alphaVal?: number) => Promise<void>;

  // Display toggles
  showBreakdown: boolean;
  setShowBreakdown: (show: boolean) => void;
  showCosine: boolean;
  setShowCosine: (show: boolean) => void;

  // Top Pages
  topPages: Page[];
  topPagesLoading: boolean;
  loadTopPages: (n?: number) => Promise<void>;

  // Link Graph
  graphData: GraphData | null;
  graphLoading: boolean;
  loadGraph: (maxNodes?: number) => Promise<void>;

  // Node Selection & Details
  selectedNode: string | null;
  selectedPageDetail: PageDetail | null;
  selectedPageLoading: boolean;
  setSelectedNode: (nodeId: string | null) => void;
  loadPageDetail: (nodeId: string) => Promise<void>;

  // Visual settings for graph
  visualSettings: VisualSettings;
  setVisualSettings: (settings: Partial<VisualSettings>) => void;
}

/** Determine initial theme from localStorage or system preference */
function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';

  const stored = localStorage.getItem('pagerank-theme');
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
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

  // Pipeline status
  pipelineStatus: null,
  backendOffline: false,
  refreshStatus: async () => {
    try {
      const status = await fetchPipelineStatus();
      set({ pipelineStatus: status, backendOffline: false });
    } catch (err) {
      set({ backendOffline: true });
    }
  },

  // Search
  query: '',
  setQuery: (query) => set({ query }),
  submittedQuery: '',
  setSubmittedQuery: (submittedQuery) => set({ submittedQuery }),
  alpha: 0.5,
  setAlpha: (alpha) => {
    set({ alpha });
    // If a search was already submitted, re-rank with new alpha
    const { submittedQuery, performSearch } = get();
    if (submittedQuery.trim()) {
      performSearch(submittedQuery, alpha);
    }
  },
  results: [],
  searchLoading: false,
  searchError: null,
  performSearch: async (qParam?: string, alphaParam?: number) => {
    const q = (qParam !== undefined ? qParam : get().query).trim();
    const a = alphaParam !== undefined ? alphaParam : get().alpha;

    if (!q) {
      set({ results: [], submittedQuery: '', searchError: null });
      return;
    }

    set({ searchLoading: true, searchError: null, submittedQuery: q });
    try {
      const results = await searchPages(q, a, 10);
      set({ results, searchLoading: false, backendOffline: false });

      // Save search log entry
      saveSearch({
        query: q,
        alpha: a,
        timestamp: new Date().toISOString(),
        resultsCount: results.length,
      });
    } catch (err: any) {
      const errorMsg = err?.status === 409
        ? 'not_crawled'
        : err?.message || 'Search request failed';
      set({
        results: [],
        searchLoading: false,
        searchError: errorMsg,
        backendOffline: err?.status === undefined,
      });
    }
  },

  // Display toggles
  showBreakdown: true,
  setShowBreakdown: (showBreakdown) => set({ showBreakdown }),
  showCosine: false,
  setShowCosine: (showCosine) => set({ showCosine }),

  // Top Pages
  topPages: [],
  topPagesLoading: false,
  loadTopPages: async (n = 10) => {
    set({ topPagesLoading: true });
    try {
      const pages = await fetchTopPages(n);
      set({ topPages: pages, topPagesLoading: false, backendOffline: false });
    } catch (err: any) {
      set({
        topPages: [],
        topPagesLoading: false,
        backendOffline: err?.status === undefined,
      });
    }
  },

  // Graph Data
  graphData: null,
  graphLoading: false,
  loadGraph: async (maxNodes = 30) => {
    set({ graphLoading: true });
    try {
      const data = await fetchGraph(maxNodes);
      set({ graphData: data, graphLoading: false, backendOffline: false });
    } catch (err: any) {
      set({
        graphData: null,
        graphLoading: false,
        backendOffline: err?.status === undefined,
      });
    }
  },

  // Node selection & detail
  selectedNode: null,
  selectedPageDetail: null,
  selectedPageLoading: false,
  setSelectedNode: (nodeId) => {
    set({ selectedNode: nodeId });
    if (nodeId) {
      get().loadPageDetail(nodeId);
    } else {
      set({ selectedPageDetail: null });
    }
  },
  loadPageDetail: async (nodeId: string) => {
    set({ selectedPageLoading: true });
    try {
      const detail = await fetchPageDetail(nodeId);
      set({ selectedPageDetail: detail, selectedPageLoading: false });
    } catch (err) {
      set({ selectedPageDetail: null, selectedPageLoading: false });
    }
  },

  // Visual settings
  visualSettings: defaultVisualSettings,
  setVisualSettings: (partial) =>
    set((state) => ({
      visualSettings: { ...state.visualSettings, ...partial },
    })),
}));
