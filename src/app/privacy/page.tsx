import { getConfig } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/content-sanitize';
import { DEFAULT_PRIVACY_HTML } from '@/lib/site-content-shared';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const content = sanitizeRichHtml(await getConfig('LEGAL_PRIVACY_HTML') || DEFAULT_PRIVACY_HTML);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}