import { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Database,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { startCrawl } from '../api/storage';

/* ═══════════════════════════════════════════════════
   CrawlPanel — Web Crawler Management & Live Progress
   Matches existing visual theme (glassmorphism & gradients)
   ═══════════════════════════════════════════════════ */

const DEFAULT_SEEDS =
  'PageRank,Search_engine,Google_Search,Web_crawler,Information_retrieval';
const DEFAULT_MAX_PAGES = 150;

export default function CrawlPanel() {
  const [seeds, setSeeds] = useState(DEFAULT_SEEDS);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [force, setForce] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const setTab = useAppStore((s) => s.setTab);

  const crawlState = pipelineStatus?.crawl?.state || 'idle';
  const isRunning = crawlState === 'running';
  const isDone = crawlState === 'done';
  const isError = crawlState === 'error';

  const fetched = pipelineStatus?.crawl?.fetched || 0;
  const targetMax = pipelineStatus?.crawl?.max_pages || maxPages;
  const currentTitle = pipelineStatus?.crawl?.current || '';
  const progressPercent = targetMax > 0 ? Math.min(100, Math.round((fetched / targetMax) * 100)) : 0;

  // Poll status while crawl is running
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        refreshStatus();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, refreshStatus]);

  // When crawl completes, refresh downstream data
  useEffect(() => {
    if (isDone) {
      loadTopPages();
      loadGraph();
    }
  }, [isDone, loadTopPages, loadGraph]);

  const handleStartCrawl = async () => {
    setErrorMsg(null);
    setStarting(true);
    try {
      await startCrawl(seeds, maxPages, force);
      await refreshStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start crawl');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      id="crawl-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-6 animate-fade-in transition-theme flex flex-col gap-6
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="
              w-10 h-10 rounded-xl
              bg-accent-gradient
              flex items-center justify-center
              shadow-glow
            "
          >
            <Globe size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Web Crawler
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Crawl Wikipedia pages to build the link graph and page database
            </p>
          </div>
        </div>

        {pipelineStatus?.crawled && (
          <span
            className="
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              bg-emerald-500/10 text-emerald-500 border border-emerald-500/20
              text-[11px] font-semibold
            "
          >
            <CheckCircle size={12} />
            Data Ready ({pipelineStatus.page_count} pages)
          </span>
        )}
      </div>

      {backendOffline && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[12px] flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>Backend server is offline. Please make sure <code className="font-mono">python server.py</code> is running on port 5000.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[12px] flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Configuration Form ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Seeds input */}
        <div className="md:col-span-2">
          <label
            htmlFor="crawl-seeds"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Seed Titles (comma-separated Wikipedia articles)
          </label>
          <input
            id="crawl-seeds"
            type="text"
            value={seeds}
            disabled={isRunning || starting}
            onChange={(e) => setSeeds(e.target.value)}
            placeholder="e.g. PageRank, Search_engine"
            className="
              w-full px-3.5 py-2.5
              rounded-xl border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              disabled:opacity-50 transition-all
            "
          />
        </div>

        {/* Max pages input */}
        <div>
          <label
            htmlFor="crawl-max-pages"
            className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
          >
            Max Pages (10 – 300)
          </label>
          <input
            id="crawl-max-pages"
            type="number"
            min={10}
            max={300}
            value={maxPages}
            disabled={isRunning || starting}
            onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
            className="
              w-full px-3.5 py-2.5
              rounded-xl border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              disabled:opacity-50 transition-all
            "
          />
        </div>
      </div>

      {/* ── Controls Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            id="chk-force"
            type="checkbox"
            checked={force}
            disabled={isRunning || starting}
            onChange={(e) => setForce(e.target.checked)}
            className="accent-[var(--accent-start)] w-4 h-4 rounded cursor-pointer disabled:opacity-50"
          />
          <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            Force re-crawl (overwrite existing <code className="font-mono text-[11px]">edges.txt</code> & <code className="font-mono text-[11px]">pages.db</code>)
          </span>
        </label>

        <button
          id="start-crawl-btn"
          onClick={handleStartCrawl}
          disabled={isRunning || starting || backendOffline}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-accent-gradient text-white text-[13px] font-semibold
            shadow-glow cursor-pointer
            hover:brightness-110 active:scale-[0.97]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          {isRunning ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Crawling...
            </>
          ) : (
            <>
              <Play size={15} fill="currentColor" />
              Start Crawl
            </>
          )}
        </button>
      </div>

      {/* ── Politeness Note ── */}
      <div className="flex items-start gap-2.5 text-[11px] text-[var(--text-muted)] bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
        <Clock size={14} className="shrink-0 mt-0.5" />
        <span>
          A crawl takes roughly a second per page (1.0 s politeness delay required by Wikipedia) plus download time. 150 pages typically takes 3 to 5 minutes.
        </span>
      </div>

      {/* ── Progress Card (shown when running, done, or errored) ── */}
      {(isRunning || isDone || isError) && (
        <div
          className="
            rounded-xl border border-[var(--border)]
            bg-[var(--bg)] p-4.5 flex flex-col gap-3.5
          "
        >
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[var(--text-primary)]">
              {isRunning && 'Crawl in progress...'}
              {isDone && 'Crawl complete!'}
              {isError && 'Crawl encountered an error.'}
            </span>
            <span className="font-mono text-[var(--text-secondary)] tabular-nums">
              {fetched} / {targetMax} pages ({progressPercent}%)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progressPercent}%`,
                background:
                  isError
                    ? '#f43f5e'
                    : isDone
                    ? '#10b981'
                    : 'linear-gradient(90deg, var(--accent-start), var(--accent-mid))',
              }}
            />
          </div>

          {isRunning && currentTitle && (
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              Fetching: <span className="font-medium text-[var(--text-secondary)]">{currentTitle}</span>
            </p>
          )}

          {isDone && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-emerald-500 font-medium">
                Successfully indexed {pipelineStatus?.page_count} pages and {pipelineStatus?.edge_count} edges.
              </span>
              <button
                id="goto-search-btn"
                onClick={() => setTab('search')}
                className="
                  flex items-center gap-1.5 px-4 py-2 rounded-xl
                  bg-accent-gradient text-white text-[12px] font-semibold
                  shadow-glow hover:brightness-110 transition-all cursor-pointer
                "
              >
                Go to Search
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {isError && (
            <p className="text-[12px] text-rose-500">
              {pipelineStatus?.crawl?.error || 'Unknown error occurred during crawl'}
            </p>
          )}
        </div>
      )}

      {/* ── Current Dataset Metrics ── */}
      {pipelineStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center">
            <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
              Crawled Pages
            </p>
            <p className="text-xl font-bold gradient-text tabular-nums">
              {pipelineStatus.page_count}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center">
            <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
              Graph Edges
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
              {pipelineStatus.edge_count}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
              Status
            </p>
            <p className="text-sm font-bold text-[var(--text-secondary)] mt-1">
              {pipelineStatus.crawled ? 'Indexed & Ready' : 'Awaiting Crawl'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
