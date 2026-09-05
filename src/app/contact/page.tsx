import { getConfig } from '@/lib/config';
import { getSiteContent } from '@/lib/site-content';
import ContactPageClient from '@/app/contact/ContactPageClient';

export const dynamic = 'force-dynamic';

const DEFAULT_CONTACT_EMAIL = 'hello@artistsite.com';

export default async function ContactPage() {
  const [pageContent, contactEmailSetting, artistEmail, supportEmail] = await Promise.all([
    getSiteContent('contact'),
    getConfig('CONTACT_EMAIL'),
    getConfig('ARTIST_EMAIL'),
    getConfig('SUPPORT_EMAIL'),
  ]);

  const contactEmail = contactEmailSetting || artistEmail || supportEmail || DEFAULT_CONTACT_EMAIL;

  return <ContactPageClient pageContent={pageContent} contactEmail={contactEmail} />;
}
