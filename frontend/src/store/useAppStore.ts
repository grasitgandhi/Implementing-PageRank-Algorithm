import { create } from 'zustand';
import type { TabId, VisualSettings } from '../types';

/* ═══════════════════════════════════════════════════
   Global application state (Zustand)
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

  // Search
  query: string;
  setQuery: (query: string) => void;
  alpha: number;             // blend factor: alpha * pagerank + (1-alpha) * relevance
  setAlpha: (alpha: number) => void;

  // Display toggles
  showBreakdown: boolean;
  setShowBreakdown: (show: boolean) => void;
  showCosine: boolean;
  setShowCosine: (show: boolean) => void;

  // Graph selection
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;

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

export const useAppStore = create<AppState>((set) => ({
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

  query: '',
  setQuery: (query) => set({ query }),
  alpha: 0.5,
  setAlpha: (alpha) => set({ alpha }),

  showBreakdown: true,
  setShowBreakdown: (showBreakdown) => set({ showBreakdown }),
  showCosine: false,
  setShowCosine: (showCosine) => set({ showCosine }),

  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  visualSettings: defaultVisualSettings,
  setVisualSettings: (partial) =>
    set((state) => ({
      visualSettings: { ...state.visualSettings, ...partial },
    })),
}));
