'use client';

import { useState } from 'react';

export default function CollectorFeedLink() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function ensureFeedUrl(): Promise<string | null> {
    if (feedUrl) return feedUrl;
    setLoading(true);
    try {
      const response = await fetch('/api/account/collector-feed', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && typeof data.feedUrl === 'string') {
        setFeedUrl(data.feedUrl);
        return data.feedUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    setCopyState('idle');
    const url = await ensureFeedUrl();
    if (!url) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 3000);
    } catch {
      setCopyState('error');
    }
  }

  return (
    <details className="mt-8 border-t border-gray-200 pt-5 text-sm text-gray-600">
      <summary className="cursor-pointer select-none font-medium text-gray-600 hover:text-gray-900">
        Subscribe in an RSS reader
      </summary>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 bg-surface-muted/60 p-4">
        <p className="text-sm text-gray-600">
          Follow collector-only studio updates in your favorite RSS app using your personal feed link.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void copyLink()}
            className="btn-primary-outline px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? 'Preparing…' : copyState === 'copied' ? 'Link copied' : 'Copy private RSS link'}
          </button>
          {copyState === 'error' && (
            <span className="text-xs text-red-600" role="alert">Could not copy link.</span>
          )}
        </div>
      </div>
    </details>
  );
}
