import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SearchPanel from './components/SearchPanel';
import ResultsTable from './components/ResultsTable';
import LinkGraphPanel from './components/LinkGraphPanel';
import TopPagesPanel from './components/TopPagesPanel';
import VisualSettingsPanel from './components/VisualSettingsPanel';
import { useAppStore } from './store/useAppStore';

/* ═══════════════════════════════════════════════════
   App — Root layout
   3-column: Sidebar (15%) | Search+Results (45%) |
   LinkGraph + TopPages + VisualSettings (40%)
   Below 768px: single column, sidebar icon-only
   ═══════════════════════════════════════════════════ */

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const activeTab = useAppStore((s) => s.activeTab);

  // Apply theme class to <html> on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-theme">
      <Navbar />
      <Sidebar />

      {/* ── Main content area ── */}
      <main
        id="main-content"
        className="
          ml-16 lg:ml-[220px]
          mt-16 p-5
          min-h-[calc(100vh-4rem)]
          transition-all duration-300 ease-out
        "
      >
        <div className="flex flex-col xl:flex-row gap-5 h-full">
          {/* ═══ Center column — Search / Tab content ═══ */}
          <div className="flex-1 flex flex-col gap-5 min-w-0 xl:max-w-[55%]">
            {activeTab === 'search' && (
              <>
                <SearchPanel />
                <ResultsTable />
              </>
            )}

            {activeTab === 'graph' && <LinkGraphPanel />}

            {activeTab === 'top-pages' && <TopPagesPanel />}

            {activeTab === 'about' && (
              <div className="
                rounded-2xl border border-[var(--border)]
                bg-[var(--card)] shadow-card
                p-8 flex flex-col items-center justify-center
                min-h-[400px]
                animate-fade-in
              ">
                <div className="
                  w-16 h-16 rounded-2xl mb-5
                  bg-accent-gradient
                  flex items-center justify-center
                  shadow-glow animate-glow-pulse
                ">
                  <span className="text-white text-2xl font-bold">ℹ️</span>
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                  About
                </h2>
                <p className="text-[13px] text-[var(--text-muted)] text-center max-w-sm">
                  PageRank Explorer visualizes how Google&apos;s PageRank algorithm
                  works alongside keyword relevance to rank web pages. Built with
                  React, D3, and Tailwind CSS.
                </p>
              </div>
            )}
          </div>

          {/* ═══ Right column — Graph + Top Pages + Visual Settings ═══ */}
          <div
            className="
              hidden xl:flex flex-col gap-5
              w-[40%] flex-shrink-0
            "
          >
            {/* Always show the graph overview in the right column */}
            {activeTab === 'search' && (
              <>
                <LinkGraphPanel />
                <TopPagesPanel />
                <VisualSettingsPanel />
              </>
            )}

            {activeTab === 'graph' && (
              <>
                <TopPagesPanel />
                <VisualSettingsPanel />
              </>
            )}

            {activeTab === 'top-pages' && (
              <>
                <LinkGraphPanel />
                <VisualSettingsPanel />
              </>
            )}

            {activeTab === 'about' && (
              <>
                <LinkGraphPanel />
                <TopPagesPanel />
                <VisualSettingsPanel />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
