import { useState, useEffect, useRef } from 'react';
import { Globe, Play, CheckCircle, AlertCircle, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { startCrawl } from '../api/storage';

/* ═══════════════════════════════════════════════════
   CrawlPanel — Web Crawler Management & Live Progress
   Matches existing visual theme (glassmorphism & gradients)
   ═══════════════════════════════════════════════════ */

const DEFAULT_SEEDS = 'PageRank,Search_engine,Google_Search,Web_crawler,Information_retrieval';
const DEFAULT_MAX_PAGES = 150;

export default function CrawlPanel() {
  const [seeds, setSeeds] = useState(DEFAULT_SEEDS);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [force, setForce] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const loadTopPages = useAppStore((s) => s.loadTopPages);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const setTab = useAppStore((s) => s.setTab);

  const crawlState = pipelineStatus?.crawl?.state || 'idle';
  const isRunning = crawlState === 'running';
  const isDone = crawlState === 'done';
  const isError = crawlState === 'error';

  const fetched = pipelineStatus?.crawl?.fetched || 0;
  const targetMax = pipelineStatus?.crawl?.max_pages || maxPages;
  const currentTitle = pipelineStatus?.crawl?.current || '';
  const progressPercent =
    targetMax > 0 ? Math.min(100, Math.round((fetched / targetMax) * 100)) : 0;

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

  const addToast = useAppStore((s) => s.addToast);
  const prevCrawlStateRef = useRef<string | null>(null);

  // When crawl completes or fails, fire toast (B5) and refresh downstream data
  useEffect(() => {
    const prevState = prevCrawlStateRef.current;
    prevCrawlStateRef.current = crawlState;

    if (prevState === 'running' && isDone) {
      addToast(
        'success',
        `Crawl finished! Indexed ${pipelineStatus?.page_count ?? fetched} pages.`
      );
      refreshStatus();
      loadTopPages();
      loadGraph();
    } else if (prevState === 'running' && isError) {
      addToast('error', `Crawl failed: ${pipelineStatus?.crawl?.error || 'Server error'}`);
    }
  }, [
    isDone,
    isError,
    crawlState,
    pipelineStatus?.crawl?.error,
    fetched,
    pipelineStatus?.page_count,
    loadTopPages,
    loadGraph,
    addToast,
  ]);

  const handleStartCrawl = async () => {
    setErrorMsg(null);
    const cleanSeeds = seeds
      .split(/[,;\n\r]+/)
      .map((s) => s.trim().replace(/^['"`]+|['"`]+$/g, ''))
      .filter(Boolean);

    if (cleanSeeds.length === 0) {
      setErrorMsg('Please enter at least one seed title or Wikipedia URL.');
      return;
    }

    setStarting(true);
    setSelectedNode(null);
    try {
      await startCrawl(cleanSeeds, maxPages, force);
      await refreshStatus();
      addToast('info', 'Crawl job started in background.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start crawl';
      setErrorMsg(msg);
      addToast('error', `Failed to start crawl: ${msg}`);
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
            <h2 className="text-base font-bold text-[var(--text-primary)]">Web Crawler</h2>
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
              text-[12px] font-semibold
            "
          >
            <CheckCircle size={13} />
            Data Ready ({pipelineStatus.page_count} pages)
          </span>
        )}
      </div>

      {backendOffline && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[12px] flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>
            Backend server is offline. Please make sure{' '}
            <code className="font-mono">python server.py</code> is running on port 5000.
          </span>
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
            Seed Titles or Wikipedia URLs (comma-separated)
          </label>
          <input
            id="crawl-seeds"
            type="text"
            value={seeds}
            disabled={isRunning || starting}
            onChange={(e) => setSeeds(e.target.value)}
            placeholder="e.g. PageRank, Search_engine, or https://en.wikipedia.org/wiki/Machine_learning"
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
            Overwrite existing database (<code className="font-mono text-[12px]">pages.db</code> &{' '}
            <code className="font-mono text-[12px]">edges.txt</code>)
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
      <div className="flex items-start gap-2.5 text-[12px] text-[var(--text-muted)] bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
        <Clock size={14} className="shrink-0 mt-0.5" />
        <span>
          A crawl takes roughly a second per page (1.0 s politeness delay required by Wikipedia)
          plus download time. 150 pages typically takes 3 to 5 minutes.
        </span>
      </div>

      {/* ── Progress Card (shown when running, done, or errored) ── */}
      {(isRunning || isDone || isError) && (
        <div
          id="crawl-progress-card"
          className="
            rounded-xl border border-[var(--border)]
            bg-[var(--bg)] p-5 flex flex-col gap-4 shadow-sm
          "
        >
          {/* Header row: status badge + page counts */}
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-gradient/10 text-[var(--accent-start)] font-semibold text-[11px] border border-[var(--accent-start)]/20 animate-pulse">
                  <RefreshCw size={12} className="animate-spin" />
                  Crawl in progress...
                </span>
              )}
              {isDone && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold text-[11px] border border-emerald-500/20">
                  <CheckCircle size={13} />
                  Crawl complete!
                </span>
              )}
              {isError && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 font-semibold text-[11px] border border-rose-500/20">
                  <AlertCircle size={13} />
                  Crawl encountered an error
                </span>
              )}
            </div>

            <span className="font-mono text-[var(--text-secondary)] tabular-nums text-[12px] font-medium">
              {fetched} / {targetMax} pages ({progressPercent}%)
            </span>
          </div>

          {/* Progress bar track & fill */}
          <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: isError
                  ? '#f43f5e'
                  : isDone
                    ? '#10b981'
                    : 'linear-gradient(90deg, var(--accent-start), var(--accent-mid))',
              }}
            />
          </div>

          {/* Current fetching title */}
          {isRunning && currentTitle && (
            <p className="text-[12px] text-[var(--text-muted)] truncate">
              Fetching:{' '}
              <span className="font-medium text-[var(--text-secondary)]">{currentTitle}</span>
            </p>
          )}

          {/* Completion summary & actions */}
          {isDone && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[12px] text-emerald-500 font-medium">
                Successfully indexed {pipelineStatus?.page_count ?? fetched} pages and{' '}
                {pipelineStatus?.edge_count ?? 0} edges.
              </span>
              <button
                id="goto-search-btn"
                onClick={() => setTab('search')}
                className="
                  inline-flex items-center gap-2 px-4 py-2 rounded-xl
                  bg-accent-gradient text-white text-[12px] font-semibold
                  shadow-glow hover:brightness-110 active:scale-[0.98]
                  transition-all duration-200 cursor-pointer shrink-0
                "
              >
                <span>Go to Search</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Error detail */}
          {isError && (
            <p className="text-[12px] text-rose-500 font-medium">
              {pipelineStatus?.crawl?.error || 'Unknown error occurred during crawl'}
            </p>
          )}
        </div>
      )}

      {/* ── Current Dataset Metrics ── */}
      {pipelineStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center">
            <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
              Crawled Pages
            </p>
            <p className="text-xl font-bold gradient-text tabular-nums">
              {pipelineStatus.page_count}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center">
            <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
              Graph Edges
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
              {pipelineStatus.edge_count}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center col-span-2 sm:col-span-1">
            <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">
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
