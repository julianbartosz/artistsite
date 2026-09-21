'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAnalytics } from '@/components/AnalyticsProvider';

type PostPermalinkActionsProps = {
  slug: string;
  title: string;
  askArtistLabel: string;
  saveUpdateLabel: string;
  signedIn: boolean;
  signInCallbackUrl: string;
};

export default function PostPermalinkActions({
  slug,
  title,
  askArtistLabel,
  saveUpdateLabel,
  signedIn,
  signInCallbackUrl,
}: PostPermalinkActionsProps) {
  const { trackSocialShare } = useAnalytics();
  const [saved, setSaved] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (!signedIn) return;
    void fetch('/api/account/saved-updates', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.saved)) {
          setSaved(data.saved.includes(slug));
        }
      })
      .catch(() => undefined);
  }, [signedIn, slug]);

  async function toggleSave() {
    if (!signedIn) return;
    const response = await fetch(saved ? `/api/account/saved-updates/${encodeURIComponent(slug)}` : '/api/account/saved-updates', {
      method: saved ? 'DELETE' : 'POST',
      headers: saved ? undefined : { 'Content-Type': 'application/json' },
      body: saved ? undefined : JSON.stringify({ postSlug: slug }),
    });
    if (response.ok) setSaved(!saved);
  }

  async function sendMessage() {
    if (!signedIn || !message.trim()) return;
    setStatus(null);
    const response = await fetch('/api/account/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postSlug: slug, postTitle: title, message: message.trim() }),
    });
    if (!response.ok) {
      setStatus('Could not send message.');
      return;
    }
    setStatus('Message sent.');
    setMessage('');
    setMessageOpen(false);
  }

  if (!signedIn) {
    return (
      <p className="text-sm text-gray-600">
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl)}`} className="text-primary hover:opacity-80">
          Sign in
        </Link>
        {' '}to save this update or message the artist.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void toggleSave()} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          {saved ? 'Saved' : saveUpdateLabel}
        </button>
        <button type="button" onClick={() => setMessageOpen(true)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          {askArtistLabel}
        </button>
        <Link href="/account?tab=messages" className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          View messages
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!shareUrl) return;
            void navigator.clipboard?.writeText(shareUrl);
            trackSocialShare('copy_link', shareUrl);
            setStatus('Link copied.');
          }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Copy link
        </button>
      </div>
      {messageOpen && (
        <div className="rounded-lg border border-gray-200 p-4">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Write your message..."
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setMessageOpen(false)} className="text-sm text-gray-600">Cancel</button>
            <button type="button" disabled={!message.trim()} onClick={() => void sendMessage()} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">Send</button>
          </div>
        </div>
      )}
      {status && <p className="text-sm text-green-700">{status}</p>}
    </div>
  );
}
