import { Suspense } from 'react';
import { getSiteContent } from '@/lib/site-content';
import CheckoutPageClient from './CheckoutPageClient';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const shop = await getSiteContent('shop');

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-muted flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900" aria-label="Loading checkout" />
        </div>
      }
    >
      <CheckoutPageClient initialShopCopy={shop} />
    </Suspense>
  );
}
