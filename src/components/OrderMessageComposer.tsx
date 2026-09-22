'use client';

import { useState } from 'react';
import Link from 'next/link';

type OrderMessageComposerProps = {
  orderId: string;
  orderNumber: string;
  messagesHref?: string;
  buttonLabel?: string;
  compact?: boolean;
};

export default function OrderMessageComposer({
  orderId,
  orderNumber,
  messagesHref = '/account?tab=messages',
  buttonLabel = 'Message about this order',
  compact = false,
}: OrderMessageComposerProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/account/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber,
          message: body.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');
      setStatus('Message sent. View replies in your account.');
      setBody('');
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={compact ? '' : 'mt-4'}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={compact ? 'text-sm font-medium text-primary hover:opacity-80' : 'btn-primary-outline rounded-md px-4 py-2 text-sm'}>
          {buttonLabel}
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Message about order #{orderNumber}</h3>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Ask a question about shipping, customization, or your order..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={sending || !body.trim()} onClick={() => void sendMessage()} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">
              {sending ? 'Sending...' : 'Send message'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}
      {status && (
        <p className={`mt-2 text-sm ${status.includes('sent') ? 'text-green-700' : 'text-red-700'}`}>
          {status}{' '}
          {status.includes('sent') && (
            <Link href={messagesHref} className="font-medium text-primary hover:opacity-80">View messages</Link>
          )}
        </p>
      )}
    </div>
  );
}
