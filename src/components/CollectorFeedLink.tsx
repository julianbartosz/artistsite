'use client';

import { useEffect, useState } from 'react';

export default function CollectorFeedLink() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/account/collector-feed', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.feedUrl === 'string') setFeedUrl(data.feedUrl);
      })
      .catch(() => undefined);
  }, []);

  if (!feedUrl) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
      <p className="font-medium text-gray-900">Private updates RSS</p>
      <p className="mt-1">Add this personal feed to your reader for collector-only posts:</p>
      <code className="mt-2 block overflow-x-auto rounded bg-white px-2 py-1 text-xs">{feedUrl}</code>
    </div>
  );
}
