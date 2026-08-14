import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { getConfig, isSecretSettingKey, maskSecret, setConfig } from '@/lib/config';

const SETTING_KEYS = [
  'ADMIN_EMAILS',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_AUTOMATIC_TAX_ENABLED',
  'EMAIL_DELIVERY_MODE',
  'WELCOME_EMAIL_ENABLED',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'CONTACT_EMAIL',
  'ARTIST_EMAIL',
  'SUPPORT_EMAIL',
  'NEWSLETTER_DELIVERY_MODE',
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_LIST_ID',
  'MAILCHIMP_SERVER_PREFIX',
  'NEXT_PUBLIC_GA4_MEASUREMENT_ID',
  'GA_API_SECRET',
  'GOOGLE_ADS_CUSTOMER_ID',
  'FACEBOOK_PIXEL_ID',
  'INSTAGRAM_ACCESS_TOKEN',
  'FACEBOOK_ACCESS_TOKEN',
  'FACEBOOK_PAGE_ID',
  'FACEBOOK_CONVERSION_API_TOKEN',
  'PINTEREST_ACCESS_TOKEN',
  'PINTEREST_BOARD_ID',
  'SOCIAL_PROVIDER',
  'AYRSHARE_API_KEY',
  'SOCIAL_PUBLISH_MODE',
  'MARKETING_EMAIL_UNIT_COST',
  'MARKETING_SOCIAL_POST_COST',
  'CART_ABANDONMENT_ENABLED',
  'CART_RECOVERY_PROMO_CODE',
  'SOCIAL_INSTAGRAM_URL',
  'SOCIAL_FACEBOOK_URL',
  'SOCIAL_X_URL',
  'SOCIAL_PINTEREST_URL',
  'SHIPPING_PROVIDER',
  'EASYPOST_API_KEY',
  'SHIP_FROM_NAME',
  'SHIP_FROM_COMPANY',
  'SHIP_FROM_STREET1',
  'SHIP_FROM_STREET2',
  'SHIP_FROM_CITY',
  'SHIP_FROM_STATE',
  'SHIP_FROM_POSTAL_CODE',
  'SHIP_FROM_COUNTRY',
  'SHIP_FROM_PHONE',
  'SHIPPING_DEFAULT_PACKAGE_WEIGHT_OZ',
  'SHIPPING_DEFAULT_PACKAGE_LENGTH_IN',
  'SHIPPING_DEFAULT_PACKAGE_WIDTH_IN',
  'SHIPPING_DEFAULT_PACKAGE_HEIGHT_IN',
  'LEGAL_PRIVACY_HTML',
  'LEGAL_TERMS_HTML',
] as const;

const SETTING_KEY_SET = new Set<string>(SETTING_KEYS);

const SettingsPayloadSchema = z.object({
  settings: z.record(z.string(), z.union([z.string(), z.boolean(), z.number(), z.null()])).default({}),
});

function serializeSetting(key: string, value: string | undefined) {
  if (isSecretSettingKey(key)) {
    return { key, value: '', status: maskSecret(value), secret: true };
  }

  return { key, value: value || '', status: value ? 'configured' : 'not_set', secret: false };
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await Promise.all(
      SETTING_KEYS.map(async (key) => serializeSetting(key, await getConfig(key)))
    );

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = SettingsPayloadSchema.parse(await request.json());

    for (const [rawKey, rawValue] of Object.entries(payload.settings)) {
      const key = rawKey.trim().toUpperCase();
      if (!SETTING_KEY_SET.has(key)) continue;

      const value = rawValue === null ? '' : String(rawValue).trim();
      if (isSecretSettingKey(key) && !value) continue;

      await setConfig(key, value, { encrypt: isSecretSettingKey(key) });
    }

    const settings = await Promise.all(
      SETTING_KEYS.map(async (key) => serializeSetting(key, await getConfig(key)))
    );

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid settings payload', details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update settings' }, { status: 500 });
  }
}