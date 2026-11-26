import { NewsletterSignup } from '@/components/NewsletterSignup';
import { findMarketEventBySlug } from '@/lib/markets';
import { getEmailBrand } from '@/lib/email';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SubscribePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const kioskParam = firstValue(params.kiosk)?.trim().toLowerCase();
  const isKiosk = kioskParam === '1' || kioskParam === 'true';
  const rawEventSlug = firstValue(params.event)?.trim() || firstValue(params.utm_campaign)?.trim() || undefined;

  const [marketEvent, brand] = await Promise.all([
    rawEventSlug ? findMarketEventBySlug(rawEventSlug).catch(() => null) : Promise.resolve(null),
    getEmailBrand().catch(() => null),
  ]);

  const artistName = brand?.siteName || 'The Studio';
  const eventSlug = marketEvent?.slug || rawEventSlug;
  const eventName = marketEvent?.name;

  if (isKiosk) {
    return (
      <div className="min-h-[80vh] bg-surface-muted flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-surface p-8 sm:p-12 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            {artistName}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            {eventName ? `Thanks for stopping by ${eventName}` : 'Stay in Touch with the Studio'}
          </h1>
          <p className="mt-3 mb-8 text-base text-gray-600 max-w-md mx-auto">
            Join the collector list for new artwork releases, upcoming pop-ups, and studio notes.
          </p>
          <NewsletterSignup
            kiosk
            eventSlug={eventSlug}
            eventName={eventName}
            placeholder="you@example.com"
            disclaimer="Only occasional studio updates. Unsubscribe any time."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface py-16 md:py-24 px-6">
      <div className="max-w-xl mx-auto text-center">
        {eventName && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            {eventName}
          </p>
        )}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Subscribe for Studio Updates</h1>
        <p className="text-gray-600 mb-8">
          Get new artwork, exhibition notes, and behind-the-scenes posts by email.
        </p>
        <NewsletterSignup eventSlug={eventSlug} eventName={eventName} />
      </div>
    </div>
  );
}
