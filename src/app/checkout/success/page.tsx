import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSiteContent } from '@/lib/site-content';
import CheckoutSuccessClient from './CheckoutSuccessClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage() {
  const shop = await getSiteContent('shop');

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-muted flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
        </div>
      }
    >
      <CheckoutSuccessClient initialShopCopy={shop} />
    </Suspense>
  );
}
