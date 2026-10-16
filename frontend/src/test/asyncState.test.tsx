import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AsyncState from '../components/AsyncState';

describe('AsyncState component — 5 UX states (Section 7C, P3)', () => {
  it('renders loading skeleton when loading=true', () => {
    render(
      <AsyncState loading={true} loadingMessage="Fetching results...">
        <div>Data loaded</div>
      </AsyncState>
    );

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(screen.getByText('Fetching results...')).toBeInTheDocument();
    expect(screen.queryByText('Data loaded')).not.toBeInTheDocument();
  });

  it('renders empty state when isEmpty=true', () => {
    const handleAction = vi.fn();
    render(
      <AsyncState
        isEmpty={true}
        emptyTitle="No Results Found"
        emptyMessage="Try a different query term."
        emptyAction={{ label: 'Clear Filters', onClick: handleAction }}
      >
        <div>Data loaded</div>
      </AsyncState>
    );

    expect(screen.getByText('No Results Found')).toBeInTheDocument();
    expect(screen.getByText('Try a different query term.')).toBeInTheDocument();

    const actionBtn = screen.getByRole('button', { name: 'Clear Filters' });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Data loaded')).not.toBeInTheDocument();
  });

  it('renders error state with retry button when error is set', () => {
    const handleRetry = vi.fn();
    render(
      <AsyncState
        error={{ kind: 'http', message: '500 Internal Error', status: 500 }}
        onRetry={handleRetry}
      >
        <div>Data loaded</div>
      </AsyncState>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('500 Internal Error')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders offline state with server start command when offline=true', () => {
    render(
      <AsyncState offline={true}>
        <div>Data loaded</div>
      </AsyncState>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Backend Service Offline')).toBeInTheDocument();
    expect(screen.getByText('python server.py')).toBeInTheDocument();
  });

  it('renders not_crawled state with CTA button when notCrawled=true', () => {
    const handleGoCrawl = vi.fn();
    render(
      <AsyncState notCrawled={true} onGoToCrawl={handleGoCrawl}>
        <div>Data loaded</div>
      </AsyncState>
    );

    expect(screen.getByText('No Crawled Data Available')).toBeInTheDocument();
    const crawlBtn = screen.getByRole('button', { name: 'Go to Crawl Panel' });
    fireEvent.click(crawlBtn);
    expect(handleGoCrawl).toHaveBeenCalledTimes(1);
  });

  it('renders ready content when all conditions pass', () => {
    render(
      <AsyncState loading={false} offline={false} notCrawled={false} error={null} isEmpty={false}>
        <div data-testid="content">Actual Content Data</div>
      </AsyncState>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Actual Content Data')).toBeInTheDocument();
  });
});
