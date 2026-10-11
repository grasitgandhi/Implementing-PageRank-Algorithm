import { useState, useEffect, useRef } from 'react';
import { Globe, Play, CheckCircle2, AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   CrawlPanel — Web Crawler Configuration & Live Status
   ═══════════════════════════════════════════════════ */

const DEFAULT_SEEDS = 'PageRank, Search_engine, Google_Search, Web_crawler, Information_retrieval';
const DEFAULT_MAX_PAGES = 150;

export default function CrawlPanel() {
  const [seeds, setSeeds] = useState(DEFAULT_SEEDS);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [force, setForce] = useState(false);

  const status = useAppStore((s) => s.status);
  const isBackendOffline = useAppStore((s) => s.isBackendOffline);
  const checkStatus = useAppStore((s) => s.checkStatus);
  const triggerCrawl = useAppStore((s) => s.triggerCrawl);
  const crawlLoading = useAppStore((s) => s.crawlLoading);
  const crawlError = useAppStore((s) => s.crawlError);
  const refreshAllData = useAppStore((s) => s.refreshAllData);

  const crawlState = status?.crawl?.state || 'idle';
  const isRunning = crawlState === 'running';
  const fetched = status?.crawl?.fetched || 0;
  const targetMax = status?.crawl?.max_pages || maxPages;
  const currentTitle = status?.crawl?.current || '';
  const progressPercent = targetMax > 0 ? Math.min(100, Math.round((fetched / targetMax) * 100)) : 0;

  // Poll status while crawl is running
  const prevRunningRef = useRef(isRunning);
  useEffect(() => {
    let timer: any = null;
    if (isRunning) {
      timer = setInterval(() => {
        checkStatus();
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, checkStatus]);

  // Detect when crawl finishes (transitions from running to done)
  useEffect(() => {
    if (prevRunningRef.current && !isRunning && crawlState === 'done') {
      refreshAllData();
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, crawlState, refreshAllData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seedList = seeds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (seedList.length === 0) return;

    await triggerCrawl(seedList, maxPages, force);
  };

  return (
    <div
      id="crawl-panel"
      className="
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card
        p-6 animate-fade-in transition-theme
        flex flex-col gap-6
      "
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow">
            <Globe size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Web Crawler
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Crawl Wikipedia pages to build the directed link graph for PageRank
            </p>
          </div>
        </div>

        {/* Existing crawl badge */}
        {status?.crawled && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[12px] font-semibold">
            <CheckCircle2 size={14} />
            <span>{status.page_count} pages · {status.edge_count} edges</span>
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Seeds input */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
            Seed Articles (comma-separated Wikipedia page titles)
          </label>
          <input
            id="seeds-input"
            type="text"
            disabled={isRunning || crawlLoading}
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
            placeholder="PageRank, Search_engine, Google_Search"
            className="
              w-full px-4 py-2.5 rounded-xl
              border border-[var(--border)]
              bg-[var(--bg)] text-[var(--text-primary)]
              text-[13px] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-start)]
              focus:ring-2 focus:ring-[var(--accent-glow)]
              disabled:opacity-50 transition-all
            "
          />
        </div>

        {/* Max pages and Force re-crawl */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
              Max Pages to Crawl (10 – 300)
            </label>
            <input
              id="max-pages-input"
              type="number"
              min={10}
              max={300}
              disabled={isRunning || crawlLoading}
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value, 10) || 10)}
              className="
                w-full px-4 py-2.5 rounded-xl
                border border-[var(--border)]
                bg-[var(--bg)] text-[var(--text-primary)]
                text-[13px]
                focus:outline-none focus:border-[var(--accent-start)]
                focus:ring-2 focus:ring-[var(--accent-glow)]
                disabled:opacity-50 transition-all
              "
            />
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="force-crawl-checkbox"
                type="checkbox"
                disabled={isRunning || crawlLoading}
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent-start)] cursor-pointer"
              />
              <span className="text-[13px] font-medium text-[var(--text-secondary)] select-none">
                Force re-crawl (overwrite existing data)
              </span>
            </label>
          </div>
        </div>

        {/* Start button & error */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <button
            id="start-crawl-btn"
            type="submit"
            disabled={isRunning || crawlLoading || isBackendOffline}
            className="
              flex items-center gap-2 px-6 py-2.5 rounded-xl
              bg-accent-gradient text-white text-[13px] font-semibold
              shadow-glow cursor-pointer
              hover:brightness-110 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Crawling in background...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Start Crawl</span>
              </>
            )}
          </button>

          {crawlError && (
            <div className="flex items-center gap-2 text-rose-500 text-[12px] font-medium">
              <AlertCircle size={15} />
              <span>{crawlError}</span>
            </div>
          )}
        </div>
      </form>

      {/* ── Live Progress & Status Bar ── */}
      {(isRunning || crawlState === 'done' || crawlState === 'error') && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[var(--text-secondary)]">
              {isRunning && 'Crawl in progress…'}
              {crawlState === 'done' && 'Crawl completed successfully!'}
              {crawlState === 'error' && 'Crawl encountered an error'}
            </span>
            <span className="font-bold tabular-nums gradient-text">
              {fetched} / {targetMax} pages ({progressPercent}%)
            </span>
          </div>

          {/* Progress bar container */}
          <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-accent-gradient transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Status footer */}
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="truncate max-w-[80%]">
              {isRunning && currentTitle && (
                <>Fetching: <span className="font-medium text-[var(--text-secondary)]">{currentTitle}</span></>
              )}
              {crawlState === 'done' && 'All pages indexed and PageRank calculated.'}
              {crawlState === 'error' && (
                <span className="text-rose-500 font-medium">
                  {status?.crawl?.error || 'Unknown error occurred'}
                </span>
              )}
            </span>
            <button
              onClick={() => checkStatus()}
              title="Refresh status"
              className="hover:text-[var(--text-primary)] transition-colors p-1"
            >
              <RotateCw size={12} className={isRunning ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
