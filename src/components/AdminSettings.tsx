'use client';

import React, { FormEvent, useEffect, useState } from 'react';

type SettingRecord = {
  key: string;
  value: string;
  status: 'configured' | 'not_set';
  secret: boolean;
};

const SETTINGS_GROUPS: Array<{ title: string; description: string; keys: Array<{ key: string; label: string; type?: string; help?: string }> }> = [
  {
    title: 'Access',
    description: 'Control who can manage the site. Keep at least one working admin email here or in ADMIN_EMAILS.',
    keys: [
      { key: 'ADMIN_EMAILS', label: 'Admin emails', help: 'Comma-separated email addresses.' },
    ],
  },
  {
    title: 'Site Identity',
    description: 'Public URLs and artist contact routing used across the site.',
    keys: [
      { key: 'NEXT_PUBLIC_SITE_URL', label: 'Public site URL' },
      { key: 'NEXT_PUBLIC_BASE_URL', label: 'Application base URL' },
      { key: 'CONTACT_EMAIL', label: 'Contact recipient email' },
      { key: 'ARTIST_EMAIL', label: 'Artist email' },
      { key: 'SUPPORT_EMAIL', label: 'Support email' },
    ],
  },
  {
    title: 'Payments',
    description: 'Stripe powers checkout. Secret fields stay encrypted and are never shown after saving.',
    keys: [
      { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key' },
      { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', type: 'password' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret', type: 'password' },
      { key: 'STRIPE_AUTOMATIC_TAX_ENABLED', label: 'Stripe automatic tax enabled', help: 'Use true or false.' },
    ],
  },
  {
    title: 'Email Delivery',
    description: 'SMTP sends contact and order-status emails. Use log mode until SMTP is ready.',
    keys: [
      { key: 'EMAIL_DELIVERY_MODE', label: 'Email delivery mode', help: 'smtp or log' },
      { key: 'WELCOME_EMAIL_ENABLED', label: 'Welcome email enabled', help: 'Use true or false.' },
      { key: 'SMTP_HOST', label: 'SMTP host' },
      { key: 'SMTP_PORT', label: 'SMTP port' },
      { key: 'SMTP_USER', label: 'SMTP user' },
      { key: 'SMTP_PASSWORD', label: 'SMTP password', type: 'password' },
      { key: 'SMTP_FROM', label: 'From email' },
    ],
  },
  {
    title: 'Newsletter',
    description: 'Mailchimp receives public newsletter signups. Use log mode while setting up.',
    keys: [
      { key: 'NEWSLETTER_DELIVERY_MODE', label: 'Newsletter delivery mode', help: 'mailchimp or log' },
      { key: 'MAILCHIMP_API_KEY', label: 'Mailchimp API key', type: 'password' },
      { key: 'MAILCHIMP_LIST_ID', label: 'Mailchimp list ID' },
      { key: 'MAILCHIMP_SERVER_PREFIX', label: 'Mailchimp server prefix' },
    ],
  },
  {
    title: 'Marketing Signals',
    description: 'Optional measurement and social publishing credentials.',
    keys: [
      { key: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', label: 'GA4 measurement ID' },
      { key: 'GA_API_SECRET', label: 'GA4 API secret', type: 'password' },
      { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads customer ID' },
      { key: 'FACEBOOK_PIXEL_ID', label: 'Facebook pixel ID' },
      { key: 'INSTAGRAM_ACCESS_TOKEN', label: 'Instagram access token', type: 'password' },
      { key: 'FACEBOOK_ACCESS_TOKEN', label: 'Facebook access token', type: 'password' },
      { key: 'FACEBOOK_PAGE_ID', label: 'Facebook page ID' },
      { key: 'FACEBOOK_CONVERSION_API_TOKEN', label: 'Facebook conversion API token', type: 'password' },
      { key: 'PINTEREST_ACCESS_TOKEN', label: 'Pinterest access token', type: 'password' },
      { key: 'PINTEREST_BOARD_ID', label: 'Pinterest board ID' },
      { key: 'SOCIAL_PROVIDER', label: 'Social publishing provider', help: 'assist, meta, or ayrshare. Ayrshare is recommended for multi-platform publishing.' },
      { key: 'AYRSHARE_API_KEY', label: 'Ayrshare API key', type: 'password' },
      { key: 'SOCIAL_PUBLISH_MODE', label: 'Social publish mode', help: 'assist or auto. Assist is safest and works without platform credentials.' },
      { key: 'MARKETING_EMAIL_UNIT_COST', label: 'Estimated cost per email', help: 'Optional dollar amount used for ROI estimates. Leave blank or 0 for actual spend only.' },
      { key: 'MARKETING_SOCIAL_POST_COST', label: 'Estimated cost per social post', help: 'Optional dollar amount used for ROI estimates. Leave blank or 0 for actual spend only.' },
      { key: 'CART_ABANDONMENT_ENABLED', label: 'Cart recovery enabled', help: 'Use true or false.' },
      { key: 'CART_RECOVERY_PROMO_CODE', label: 'Cart recovery promo code', help: 'Optional existing promo code to include in recovery emails.' },
      { key: 'SOCIAL_INSTAGRAM_URL', label: 'Instagram profile URL' },
      { key: 'SOCIAL_FACEBOOK_URL', label: 'Facebook page URL' },
      { key: 'SOCIAL_X_URL', label: 'X profile URL' },
      { key: 'SOCIAL_PINTEREST_URL', label: 'Pinterest profile URL' },
    ],
  },
  {
    title: 'Shipping',
    description: 'Manual carrier tracking always works. Add a provider key only when you want in-site rates and labels.',
    keys: [
      { key: 'SHIPPING_PROVIDER', label: 'Shipping provider', help: 'manual or easypost. Manual remains the fallback.' },
      { key: 'EASYPOST_API_KEY', label: 'EasyPost API key', type: 'password' },
      { key: 'SHIP_FROM_NAME', label: 'Ship-from name' },
      { key: 'SHIP_FROM_COMPANY', label: 'Ship-from company' },
      { key: 'SHIP_FROM_STREET1', label: 'Ship-from street' },
      { key: 'SHIP_FROM_STREET2', label: 'Ship-from apartment/suite' },
      { key: 'SHIP_FROM_CITY', label: 'Ship-from city' },
      { key: 'SHIP_FROM_STATE', label: 'Ship-from state/region' },
      { key: 'SHIP_FROM_POSTAL_CODE', label: 'Ship-from postal code' },
      { key: 'SHIP_FROM_COUNTRY', label: 'Ship-from country', help: 'Use a two-letter country code such as US.' },
      { key: 'SHIP_FROM_PHONE', label: 'Ship-from phone' },
      { key: 'SHIPPING_DEFAULT_PACKAGE_WEIGHT_OZ', label: 'Default package weight (oz)' },
      { key: 'SHIPPING_DEFAULT_PACKAGE_LENGTH_IN', label: 'Default package length (in)' },
      { key: 'SHIPPING_DEFAULT_PACKAGE_WIDTH_IN', label: 'Default package width (in)' },
      { key: 'SHIPPING_DEFAULT_PACKAGE_HEIGHT_IN', label: 'Default package height (in)' },
    ],
  },
  {
    title: 'Site Pages',
    description: 'Public legal content editable without code changes.',
    keys: [
      { key: 'LEGAL_PRIVACY_HTML', label: 'Privacy policy', type: 'multiline', help: 'Plain text or simple HTML. Unsafe markup is stripped before display.' },
      { key: 'LEGAL_TERMS_HTML', label: 'Terms of service', type: 'multiline', help: 'Plain text or simple HTML. Unsafe markup is stripped before display.' },
    ],
  },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, SettingRecord>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load settings');
      const records = Object.fromEntries((data.settings || []).map((item: SettingRecord) => [item.key, item]));
      setSettings(records);
      setDraft(Object.fromEntries((data.settings || []).map((item: SettingRecord) => [item.key, item.value || ''])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save settings');
      const records = Object.fromEntries((data.settings || []).map((item: SettingRecord) => [item.key, item]));
      setSettings(records);
      setDraft(Object.fromEntries((data.settings || []).map((item: SettingRecord) => [item.key, item.value || ''])));
      setMessage('Settings saved. Secret values are hidden after saving.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border bg-white p-6 text-gray-600">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.title} className="rounded-lg border bg-white p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {group.keys.map((field) => {
              const record = settings[field.key];
              return (
                <label key={field.key} className="block text-sm font-medium text-gray-700">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span>{field.label}</span>
                    {record?.secret && (
                      <span className={record.status === 'configured' ? 'text-green-700' : 'text-gray-500'}>
                        {record.status === 'configured' ? 'Configured' : 'Not set'}
                      </span>
                    )}
                  </div>
                  {field.type === 'multiline' ? (
                    <textarea
                      value={draft[field.key] || ''}
                      onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                      rows={8}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={draft[field.key] || ''}
                      placeholder={record?.secret && record.status === 'configured' ? 'Leave blank to keep current secret' : ''}
                      onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  )}
                  {field.help && <p className="mt-1 text-xs text-gray-500">{field.help}</p>}
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="rounded bg-gray-900 px-5 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}