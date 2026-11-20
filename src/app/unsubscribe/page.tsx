import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { isNewsletterSubscriber, verifyUnsubscribeToken } from '@/lib/newsletter-subscribers';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string; done?: string }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token, done } = await searchParams;
  const email = verifyUnsubscribeToken(token);
  const subscribed = email && !done ? await isNewsletterSubscriber(email) : false;

  let title = 'Unsubscribe from studio updates';
  let body: ReactNode;

  if (!email) {
    title = 'This unsubscribe link isn’t complete';
    body = <p className="text-gray-600">Open the link from the bottom of any newsletter again, or reply to that email and we’ll take you off the list.</p>;
  } else if (subscribed) {
    body = (
      <>
        <p className="text-gray-600 mb-8">
          You’ll stop receiving newsletters at <strong className="text-gray-900">{email}</strong>.
        </p>
        <form method="post" action="/api/newsletter/unsubscribe">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="source" value="page" />
          <button type="submit" className="btn-primary px-6 py-3">Unsubscribe</button>
        </form>
      </>
    );
  } else {
    title = 'You’re unsubscribed';
    body = (
      <p className="text-gray-600">
        <strong className="text-gray-900">{email}</strong> won’t receive any more newsletters.{' '}
        Changed your mind? <Link href="/subscribe" className="underline hover:text-gray-900">Subscribe again</Link>.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
        {body}
      </div>
    </div>
  );
}
