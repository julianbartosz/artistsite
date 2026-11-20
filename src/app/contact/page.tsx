import { getConfig } from '@/lib/config';
import { getSiteContent } from '@/lib/site-content';
import ContactPageClient from '@/app/contact/ContactPageClient';

export const dynamic = 'force-dynamic';

type ContactPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : {};
  const [pageContent, contactEmailSetting, artistEmail, supportEmail] = await Promise.all([
    getSiteContent('contact'),
    getConfig('CONTACT_EMAIL'),
    getConfig('ARTIST_EMAIL'),
    getConfig('SUPPORT_EMAIL'),
  ]);

  const contactEmail = contactEmailSetting || artistEmail || supportEmail || '';

  return (
    <ContactPageClient
      pageContent={pageContent}
      contactEmail={contactEmail}
      initialSubject={firstParam(params.subject)}
      initialInquiryType={firstParam(params.inquiryType) || undefined}
    />
  );
}
