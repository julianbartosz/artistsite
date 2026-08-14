import { getConfig } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/content-sanitize';

const DEFAULT_TERMS_HTML = `
  <p>By using this site, you agree to use it for lawful purchases, inquiries, and account activity related to the artist's work.</p>
  <p>Artwork availability, pricing, shipping costs, and estimated delivery dates may change before checkout is completed. A purchase is confirmed only after payment is successfully processed.</p>
  <p>Original artwork and digital content remain protected by copyright. Purchasing an artwork does not transfer reproduction, licensing, or commercial-use rights unless separately agreed in writing.</p>
  <p>Questions about an order, commission, shipment, return, or damaged delivery should be sent through the contact page so the studio can review the request.</p>
`;

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const content = sanitizeRichHtml(await getConfig('LEGAL_TERMS_HTML') || DEFAULT_TERMS_HTML);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold text-gray-900">Terms of Service</h1>
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  );
}