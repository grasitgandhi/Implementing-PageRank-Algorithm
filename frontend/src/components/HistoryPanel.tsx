import { useEffect } from 'react';
import { History, TrendingUp, Search, Clock, RotateCcw, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import AsyncState from './AsyncState';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Tooltip from './ui/Tooltip';
import { formatRelativeTime, formatExactTime } from '../utils/format';

/* ═══════════════════════════════════════════════════
   HistoryPanel — Query log and popular searches (B1, P11)
   Newest first, click-to-replay, popular queries aggregation.
   Accessible on all desktop viewport widths (P5).
   ═══════════════════════════════════════════════════ */

export default function HistoryPanel() {
  const historyEntries = useAppStore((s) => s.historyEntries);
  const historyLoading = useAppStore((s) => s.historyLoading);
  const historyError = useAppStore((s) => s.historyError);
  const backendOffline = useAppStore((s) => s.backendOffline);
  const loadHistory = useAppStore((s) => s.loadHistory);
  const getPopularQueries = useAppStore((s) => s.getPopularQueries);
  const performSearch = useAppStore((s) => s.performSearch);
  const setQuery = useAppStore((s) => s.setQuery);
  const setAlpha = useAppStore((s) => s.setAlpha);
  const setTab = useAppStore((s) => s.setTab);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const popularQueries = getPopularQueries();

  const handleSelectQuery = (query: string, alphaVal: number) => {
    setQuery(query);
    setAlpha(alphaVal);
    setTab('search');
    performSearch(query, alphaVal, true);
  };

  return (
    <div id="history-panel" className="flex flex-col gap-5 animate-fade-in">
      {/* ── Popular Searches Section ── */}
      {popularQueries.length > 0 && (
        <Card
          icon={<TrendingUp size={16} />}
          title="Frequent Queries"
          subtitle="Computed client-side from logged search sessions"
        >
          <div className="flex flex-wrap gap-2 pt-1" role="list" aria-label="Frequent Queries">
            {popularQueries.map((item) => (
              <button
                key={item.query}
                role="listitem"
                onClick={() => handleSelectQuery(item.query, item.lastAlpha)}
                className="
                  flex items-center gap-2 px-3 py-1.5 rounded-xl
                  bg-[var(--bg)] hover:bg-[var(--card-hover)]
                  border border-[var(--border)] hover:border-[var(--border-hover)]
                  text-[12px] font-medium text-[var(--text-primary)]
                  transition-all duration-200 cursor-pointer group shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
                "
              >
                <Search
                  size={13}
                  className="text-[var(--accent-start)] shrink-0"
                  aria-hidden="true"
                />
                <span className="font-semibold">{item.query}</span>
                <Badge variant="accent" size="sm">
                  {item.count}×
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Search History Log List ── */}
      <Card
        icon={<History size={16} />}
        title="Search History Log"
        subtitle="Chronological query audit trail with parameters and timestamps"
        headerAction={
          <button
            onClick={() => loadHistory()}
            disabled={historyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[12px] font-medium text-[var(--text-secondary)] transition-all cursor-pointer"
            title="Refresh history"
            aria-label="Refresh search history"
          >
            <RotateCcw
              size={13}
              className={historyLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        }
      >
        <AsyncState
          loading={historyLoading}
          offline={backendOffline}
          error={historyError}
          onRetry={() => loadHistory()}
          isEmpty={historyEntries.length === 0}
          emptyTitle="No searches recorded yet"
          emptyMessage="Perform searches using the Search tab or press Enter to record queries here."
          emptyAction={{
            label: 'Go to Search',
            onClick: () => setTab('search'),
          }}
        >
          <div className="flex flex-col gap-2" role="list" aria-label="Search History Entries">
            {historyEntries.map((entry, idx) => (
              <div
                key={`${entry.query}-${entry.timestamp}-${idx}`}
                role="listitem"
                onClick={() => handleSelectQuery(entry.query, entry.alpha)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSelectQuery(entry.query, entry.alpha);
                  }
                }}
                className="
                  flex items-center justify-between gap-3 p-3.5 rounded-xl
                  border border-[var(--border)] bg-[var(--bg)]
                  hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]
                  cursor-pointer transition-all duration-200 group
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
                "
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--accent-start)]">
                    <Search size={14} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-start)] transition-colors truncate">
                        {entry.query}
                      </span>
                      {entry.resultsCount !== undefined && (
                        <Badge variant="default" size="sm">
                          {entry.resultsCount} results
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] mt-0.5">
                      <span>
                        Alpha:{' '}
                        <span className="font-mono font-semibold text-[var(--text-secondary)]">
                          {entry.alpha.toFixed(2)}
                        </span>
                      </span>
                      <span>·</span>
                      <Tooltip content={formatExactTime(entry.timestamp)}>
                        <span className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors">
                          <Clock size={11} aria-hidden="true" />
                          <span>{formatRelativeTime(entry.timestamp)}</span>
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-medium text-[var(--accent-start)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <span>Re-run</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AsyncState>
      </Card>
    </div>
  );
}
