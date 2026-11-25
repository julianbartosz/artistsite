import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSiteContent } from '@/lib/site-content';
import { getConfig } from '@/lib/config';
import { getCheckoutRuntimeConfig } from '@/lib/stripe';
import CheckoutPageClient from './CheckoutPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage() {
  const [shop, checkoutConfig, stripePublishableKey] = await Promise.all([
    getSiteContent('shop'),
    getCheckoutRuntimeConfig(),
    getConfig('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  ]);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-muted flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900" aria-label="Loading checkout" />
        </div>
      }
    >
      <CheckoutPageClient
        initialShopCopy={shop}
        checkoutMode={checkoutConfig.checkoutMode}
        manualPaymentInstructions={checkoutConfig.manualPaymentInstructions}
        automaticTaxEnabled={checkoutConfig.automaticTaxEnabled}
        stripePublishableKey={stripePublishableKey || ''}
        isE2e={process.env.PLAYWRIGHT_E2E === 'true'}
      />
    </Suspense>
  );
}
