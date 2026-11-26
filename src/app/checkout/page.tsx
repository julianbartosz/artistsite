import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSiteContent } from '@/lib/site-content';
import { getConfig } from '@/lib/config';
import { getCheckoutRuntimeConfig } from '@/lib/stripe';
import { getAllProducts } from '@/lib/commerce-server';
import { findMarketEventBySlug } from '@/lib/markets';
import { parseMarketPayParams } from '@/lib/market-qr';
import type { Product } from '@/lib/commerce';
import CheckoutPageClient from './CheckoutPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: {
    index: false,
    follow: false,
  },
};

export interface MarketCheckoutBootstrap {
  eventSlug: string;
  eventName: string | null;
  salesTaxRate: number;
  promoCode: string;
  items: Array<{ product: Product; quantity: number }>;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedParams, shop, checkoutConfig, stripePublishableKey] = await Promise.all([
    searchParams,
    getSiteContent('shop'),
    getCheckoutRuntimeConfig(),
    getConfig('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  ]);

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === 'string') urlParams.set(key, value);
    else if (Array.isArray(value) && typeof value[0] === 'string') urlParams.set(key, value[0]);
  }

  const parsedMarket = parseMarketPayParams(urlParams);
  let marketBootstrap: MarketCheckoutBootstrap | null = null;

  if (parsedMarket.isMarketMode) {
    const [allProducts, matchedEvent] = await Promise.all([
      parsedMarket.items.length > 0 ? getAllProducts() : Promise.resolve([]),
      parsedMarket.eventSlug ? findMarketEventBySlug(parsedMarket.eventSlug) : Promise.resolve(null),
    ]);

    const matchedItems: Array<{ product: Product; quantity: number }> = [];
    for (const spec of parsedMarket.items) {
      const product = allProducts.find((p) => p.id === spec.productId || p.slug === spec.productId);
      if (product) {
        matchedItems.push({ product, quantity: spec.quantity });
      }
    }

    marketBootstrap = {
      eventSlug: matchedEvent?.slug || parsedMarket.eventSlug || 'market',
      eventName: matchedEvent?.name || null,
      salesTaxRate: matchedEvent?.salesTaxRate ?? 0,
      promoCode: parsedMarket.promoCode || matchedEvent?.promoCode || '',
      items: matchedItems,
    };
  }

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
        marketBootstrap={marketBootstrap}
      />
    </Suspense>
  );
}
