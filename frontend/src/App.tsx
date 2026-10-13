import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CrawlPanel from './components/CrawlPanel';
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
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const refreshStatus = useAppStore((s) => s.refreshStatus);

  // Apply theme class to <html> on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Check initial backend and crawl pipeline status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-theme">
      <Navbar />
      <Sidebar />

      {/* ── Main content area ── */}
      <main
        id="main-content"
        className={`
          mt-16 p-5
          min-h-[calc(100vh-4rem)]
          transition-all duration-300 ease-out
          ${sidebarCollapsed ? 'ml-16' : 'ml-16 lg:ml-[220px]'}
        `}
      >
        <div className="flex flex-col xl:flex-row gap-5 h-full">
          {/* ═══ Center column — Search / Tab content ═══ */}
          <div className="flex-1 flex flex-col gap-5 min-w-0 xl:max-w-[55%]">
            {activeTab === 'crawl' && <CrawlPanel />}

            {activeTab === 'search' && (
              <>
                <SearchPanel />
                <ResultsTable />
                <TopPagesPanel />
              </>
            )}

            {activeTab === 'graph' && <LinkGraphPanel />}

            {activeTab === 'top-pages' && <TopPagesPanel />}
          </div>

          {/* ═══ Right column — Graph + Visual Settings ═══ */}
          <div
            className="
              hidden xl:flex flex-col gap-5
              w-[40%] flex-shrink-0
            "
          >
            {activeTab === 'search' && (
              <>
                <LinkGraphPanel />
                <VisualSettingsPanel />
              </>
            )}

            {activeTab === 'crawl' && (
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
          </div>
        </div>
      </main>
    </div>
  );
}
