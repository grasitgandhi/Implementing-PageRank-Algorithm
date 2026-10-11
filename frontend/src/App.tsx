import { useEffect } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
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
   3-column: Sidebar | Center Column | Right Column
   Collapsible sidebar and responsive scroll layout
   ═══════════════════════════════════════════════════ */

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const activeTab = useAppStore((s) => s.activeTab);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const isBackendOffline = useAppStore((s) => s.isBackendOffline);
  const checkStatus = useAppStore((s) => s.checkStatus);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
  const loadGraph = useAppStore((s) => s.loadGraph);

  // Apply theme class to <html> on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Initial data loading on mount
  useEffect(() => {
    checkStatus().then((status) => {
      if (status?.crawled) {
        loadTopPages(10);
        loadGraph(30);
      }
    });
  }, [checkStatus, loadTopPages, loadGraph]);

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-theme">
      <Navbar />
      <Sidebar />

      {/* ── Main content area with dynamic sidebar offset ── */}
      <main
        id="main-content"
        className={`
          mt-16 p-5
          min-h-[calc(100vh-4rem)]
          transition-all duration-300 ease-out
          ${sidebarCollapsed ? 'ml-16' : 'ml-16 lg:ml-[220px]'}
        `}
      >
        {/* ── Backend Offline Banner ── */}
        {isBackendOffline && (
          <div
            id="offline-banner"
            className="
              mb-5 p-4 rounded-2xl
              bg-rose-500/10 border border-rose-500/20
              text-rose-600 dark:text-rose-400
              flex items-center justify-between gap-3
              animate-fade-in
            "
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div className="text-[13px]">
                <span className="font-bold">Backend server is offline.</span>{' '}
                Please start the Python server on port 5000:
                <code className="ml-2 px-2 py-0.5 rounded bg-rose-500/10 font-mono font-semibold text-[12px]">
                  python server.py
                </code>
              </div>
            </div>
            <button
              onClick={() => checkStatus()}
              className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                bg-rose-500/15 hover:bg-rose-500/25
                text-[12px] font-semibold transition-colors
                cursor-pointer shrink-0
              "
            >
              <RotateCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-5 h-full">
          {/* ═══ Center column — Tab content ═══ */}
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

          {/* ═══ Right column — Graph + Top Pages + Visual Settings ═══ */}
          <div
            className="
              hidden xl:flex flex-col gap-5
              w-[40%] flex-shrink-0
            "
          >
            {activeTab === 'crawl' && (
              <>
                <TopPagesPanel />
                <LinkGraphPanel />
              </>
            )}

            {activeTab === 'search' && (
              <>
                <LinkGraphPanel />
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
