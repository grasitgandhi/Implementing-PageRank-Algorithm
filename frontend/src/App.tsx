import { useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CrawlPanel from './components/CrawlPanel';
import SearchPanel from './components/SearchPanel';
import ResultsTable from './components/ResultsTable';
import VisualSettingsPanel from './components/VisualSettingsPanel';
import ToastContainer from './components/ui/ToastContainer';
import AsyncState from './components/AsyncState';
import { useAppStore } from './store/useAppStore';

// Section 7D: Lazy-load heavy Graph and History components for initial bundle optimization
const LinkGraphPanel = lazy(() => import('./components/LinkGraphPanel'));
const HistoryPanel = lazy(() => import('./components/HistoryPanel'));

/* ═══════════════════════════════════════════════════
   App — Root layout & Desktop Responsive Grid (P5 Fix)
   Guarantees 100% panel reachability across all desktop viewport
   widths: 1024px, 1280px, 1440px, and 1920px.
   Below 1280px (xl): secondary panels stack below primary views
   without being hidden or causing horizontal overflow.
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

  const hasSecondaryColumn = activeTab === 'graph';

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-theme text-[var(--text-primary)]">
      <Navbar />
      <Sidebar />
      <ToastContainer />

      {/* ── Main content area with landmark semantics ── */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`
          mt-16 p-5
          min-h-[calc(100vh-4rem)]
          transition-all duration-300 ease-out
          ${sidebarCollapsed ? 'ml-16' : 'ml-16 lg:ml-[220px]'}
        `}
      >
        <div className="flex flex-col xl:flex-row gap-5 h-full max-w-[1920px] mx-auto">
          {/* ═══ Primary Column ═══ */}
          <div
            className={`flex-1 flex flex-col gap-5 min-w-0 ${
              hasSecondaryColumn ? 'xl:max-w-[65%]' : 'max-w-6xl mx-auto w-full'
            }`}
          >
            {activeTab === 'crawl' && <CrawlPanel />}

            {activeTab === 'search' && (
              <>
                <SearchPanel />
                <ResultsTable />
              </>
            )}

            {activeTab === 'graph' && (
              <Suspense
                fallback={
                  <AsyncState loading={true} loadingMessage="Loading graph view...">
                    {null}
                  </AsyncState>
                }
              >
                <LinkGraphPanel />
              </Suspense>
            )}

            {activeTab === 'history' && (
              <Suspense
                fallback={
                  <AsyncState loading={true} loadingMessage="Loading search history...">
                    {null}
                  </AsyncState>
                }
              >
                <HistoryPanel />
              </Suspense>
            )}
          </div>

          {/* ═══ Secondary Column (Visual Settings — only visible on Graph page) ═══ */}
          {hasSecondaryColumn && (
            <div
              className="
                flex flex-col gap-5
                w-full xl:w-[35%] flex-shrink-0
              "
            >
              <VisualSettingsPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
