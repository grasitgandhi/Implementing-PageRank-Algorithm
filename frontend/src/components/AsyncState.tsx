import React from 'react';
import { AlertCircle, WifiOff, Globe, RotateCcw } from 'lucide-react';
import type { ApiErrorPayload } from '../types';

/* ═══════════════════════════════════════════════════
   AsyncState — Unified 5-state container (Section 7C, P3)
   Handles: loading (skeleton), empty, error, offline, not_crawled
   Provides accessible ARIA live regions and actionable recovery buttons.
   ═══════════════════════════════════════════════════ */

export interface AsyncStateProps {
  /** True when asynchronous operation is pending */
  loading?: boolean;
  /** Custom skeleton structure, otherwise defaults to accessible pulsing rows */
  loadingSkeleton?: React.ReactNode;
  /** Accessible text for loading state */
  loadingMessage?: string;

  /** True when backend is unreachable */
  offline?: boolean;

  /** True when dataset is not yet crawled (409 or pipelineStatus.crawled === false) */
  notCrawled?: boolean;
  /** Action handler to redirect to Crawl tab */
  onGoToCrawl?: () => void;

  /** Typed API error payload or error message */
  error?: ApiErrorPayload | string | null;
  /** Callback to retry the failed action */
  onRetry?: () => void;

  /** True when data loaded successfully but result set is empty */
  isEmpty?: boolean;
  /** Title for empty state */
  emptyTitle?: string;
  /** Guidance message explaining how to populate data */
  emptyMessage?: string;
  /** Custom icon for empty state */
  emptyIcon?: React.ReactNode;
  /** Optional action button on empty state */
  emptyAction?: {
    label: string;
    onClick: () => void;
  };

  /** Content to render when state is ready */
  children: React.ReactNode;
}

export default function AsyncState({
  loading = false,
  loadingSkeleton,
  loadingMessage = 'Loading data...',
  offline = false,
  notCrawled = false,
  onGoToCrawl,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle = 'No data available',
  emptyMessage = 'There is currently no information to display.',
  emptyIcon,
  emptyAction,
  children,
}: AsyncStateProps) {
  // 1. Offline State (highest priority error)
  if (offline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center my-2"
      >
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
          <WifiOff size={22} aria-hidden="true" />
        </div>
        <h4 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
          Backend Service Offline
        </h4>
        <p className="text-[12px] text-[var(--text-muted)] max-w-md mb-3 leading-relaxed">
          The Python API server is unreachable at{' '}
          <code className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)]">
            http://localhost:5000
          </code>
          .
        </p>
        <div className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[12px] text-[var(--text-secondary)] mb-4">
          python server.py
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[12px] font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:shadow"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Not Crawled State
  if (notCrawled) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center my-2"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
          <Globe size={22} aria-hidden="true" />
        </div>
        <h4 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
          No Crawled Data Available
        </h4>
        <p className="text-[12px] text-[var(--text-muted)] max-w-sm mb-4 leading-relaxed">
          The corpus and link graph have not been crawled yet. Start by crawling Wikipedia pages in
          the Crawl panel.
        </p>
        {onGoToCrawl && (
          <button
            id="gate-crawl-btn"
            onClick={onGoToCrawl}
            className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-[12px] font-semibold shadow-glow hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            Go to Crawl Panel
          </button>
        )}
      </div>
    );
  }

  // 3. Loading State (Accessible Skeleton)
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={loadingMessage}
        className="w-full py-4 space-y-3 animate-pulse"
      >
        <span className="sr-only">{loadingMessage}</span>
        {loadingSkeleton || (
          <div className="space-y-3">
            <div className="h-4 bg-[var(--border)] rounded-md w-1/3" />
            <div className="h-10 bg-[var(--border)] rounded-xl w-full" />
            <div className="h-10 bg-[var(--border)] rounded-xl w-full" />
            <div className="h-10 bg-[var(--border)] rounded-xl w-4/5" />
          </div>
        )}
      </div>
    );
  }

  // 4. Error State
  if (error) {
    const errorText = typeof error === 'string' ? error : error.message;
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center my-2"
      >
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2">
          <AlertCircle size={20} aria-hidden="true" />
        </div>
        <h4 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">Request Failed</h4>
        <p className="text-[12px] text-rose-400 max-w-sm mb-3">{errorText}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[12px] font-semibold text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // 5. Empty State
  if (isEmpty) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center py-10 px-4 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex items-center justify-center mb-3 text-[var(--text-muted)]">
          {emptyIcon || <Globe size={22} />}
        </div>
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">{emptyTitle}</h4>
        <p className="text-[12px] text-[var(--text-muted)] max-w-sm leading-relaxed mb-4">
          {emptyMessage}
        </p>
        {emptyAction && (
          <button
            onClick={emptyAction.onClick}
            className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-[12px] font-semibold shadow-glow hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            {emptyAction.label}
          </button>
        )}
      </div>
    );
  }

  // Content Ready State
  return <>{children}</>;
}
