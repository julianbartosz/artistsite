import type { Metadata } from 'next';
import { getConfig } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/content-sanitize';
import { DEFAULT_TERMS_HTML } from '@/lib/site-content-shared';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms of Service',
  alternates: { canonical: '/terms' },
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};

export default async function TermsPage() {
  const content = sanitizeRichHtml(await getConfig('LEGAL_TERMS_HTML') || DEFAULT_TERMS_HTML);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold text-gray-900">Terms of Service</h1>
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}