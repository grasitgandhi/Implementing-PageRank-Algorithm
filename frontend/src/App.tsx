import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { useAppStore } from './store/useAppStore';

/* ═══════════════════════════════════════════════════
   App — Root layout
   Renders Navbar + Sidebar + an Outlet placeholder
   for the main + right columns (Parts 2 & 3 will fill)
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
        {/* ═══ Outlet placeholder ═══
            Parts 2 and 3 will replace this with:
            - SearchPanel + ResultsTable + ScoreBar (Part 2 — center column)
            - LinkGraphPanel + NodeDetailsPanel + TopPagesPanel +
              VisualSettingsPanel (Part 3 — right column)
        */}
        <div className="flex gap-5 h-full">
          {/* Center column placeholder */}
          <div className="flex-1 flex flex-col gap-5">
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
                <span className="text-white text-2xl font-bold">
                  {activeTab === 'search' ? '🔍' : activeTab === 'top-pages' ? '🏆' : activeTab === 'graph' ? '🕸️' : 'ℹ️'}
                </span>
              </div>

              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {activeTab === 'search'
                  ? 'Search Panel'
                  : activeTab === 'top-pages'
                  ? 'Top Pages'
                  : activeTab === 'graph'
                  ? 'Link Graph'
                  : 'About'}
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] text-center max-w-sm">
                This area will be populated by{' '}
                <span className="font-semibold gradient-text">Part 2</span> with the
                SearchPanel, ResultsTable, and ScoreBar components.
              </p>
            </div>
          </div>

          {/* Right column placeholder */}
          <div className="hidden xl:flex flex-col gap-5 w-[340px] flex-shrink-0">
            <div className="
              rounded-2xl border border-[var(--border)]
              bg-[var(--card)] shadow-card
              p-6 flex flex-col items-center justify-center
              min-h-[200px]
              animate-slide-in
            ">
              <p className="text-[13px] text-[var(--text-muted)] text-center">
                Right panel — <span className="font-semibold gradient-text">Part 3</span> will
                add NodeDetails, TopPages, VisualSettings, and the Graph.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
