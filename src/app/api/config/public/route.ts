import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getCheckoutRuntimeConfig } from '@/lib/stripe';

const PUBLIC_CONFIG_KEYS = [
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_GA4_MEASUREMENT_ID',
  'CONTACT_EMAIL',
  'ARTIST_EMAIL',
  'SUPPORT_EMAIL',
  'SOCIAL_INSTAGRAM_URL',
  'SOCIAL_FACEBOOK_URL',
  'SOCIAL_X_URL',
  'SOCIAL_PINTEREST_URL',
] as const;

export async function GET() {
  const [entries, checkoutConfig, facebookPixelId] = await Promise.all([
    Promise.all(PUBLIC_CONFIG_KEYS.map(async (key) => [key, await getConfig(key)] as const)),
    getCheckoutRuntimeConfig(),
    getConfig('FACEBOOK_PIXEL_ID'),
  ]);

  return NextResponse.json({
    ...Object.fromEntries(entries),
    CHECKOUT_MODE: checkoutConfig.checkoutMode,
    MANUAL_PAYMENT_INSTRUCTIONS: checkoutConfig.manualPaymentInstructions,
    STRIPE_AUTOMATIC_TAX_ENABLED: checkoutConfig.automaticTaxEnabled,
    FACEBOOK_PIXEL_ID: facebookPixelId || '',
  });
}
