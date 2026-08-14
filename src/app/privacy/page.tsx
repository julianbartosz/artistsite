import { getConfig } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/content-sanitize';

const DEFAULT_PRIVACY_HTML = `
  <p>We collect the information needed to operate this site, respond to inquiries, process orders, deliver artwork, and send updates when a visitor subscribes or creates an account.</p>
  <p>Order and payment details are handled through secure service providers. Payment card details are processed by Stripe and are not stored by this site.</p>
  <p>Marketing emails are sent only when a visitor subscribes, creates an account, or begins a purchase flow that supports customer service follow-up. Each email may include unsubscribe or contact options where applicable.</p>
  <p>Contact the studio to request access, correction, or deletion of personal information associated with your account or order history.</p>
`;

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const content = sanitizeRichHtml(await getConfig('LEGAL_PRIVACY_HTML') || DEFAULT_PRIVACY_HTML);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  );
}