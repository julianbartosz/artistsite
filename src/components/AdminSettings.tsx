'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isSiteCustomizationComplete } from '@/lib/setup-readiness';
import type { SiteContentByPage } from '@/lib/site-content-shared';

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
      { key: 'FACEBOOK_PIXEL_ID', label: 'Facebook pixel ID', help: 'Used for site analytics. Instagram Business posts use the Facebook token below.' },
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
    title: 'Automation',
    description: 'Scheduled emails, cart recovery, and social posts. Save a cron secret, then use Run automations now or schedule your host to call the cron URL hourly.',
    keys: [
      { key: 'CRON_SECRET', label: 'Automation secret', type: 'password', help: 'Used to authorize scheduled automation runs. Click Run automations now after saving.' },
      { key: 'CART_ABANDONMENT_ENABLED', label: 'Cart recovery enabled', help: 'Use true or false.' },
      { key: 'CART_RECOVERY_PROMO_CODE', label: 'Cart recovery promo code', help: 'Optional existing promo code to include in recovery emails.' },
    ],
  },
];

const ADVANCED_GROUP_TITLES = new Set(['Marketing Signals', 'Automation']);

export function adminSettingFieldId(key: string): string {
  return `setting-${key}`;
}

export function adminSettingFieldHref(key: string): string {
  return `/admin?tab=settings#${adminSettingFieldId(key)}`;
}

function focusSettingFieldFromHash(): void {
  if (typeof window === 'undefined') return;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith('setting-')) return;
  const el = document.getElementById(raw);
  if (!el) return;

  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    if (parent.tagName === 'DETAILS') {
      (parent as HTMLDetailsElement).open = true;
    }
    parent = parent.parentElement;
  }

  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el.querySelector('input, textarea') as HTMLElement | null;
    input?.focus({ preventScroll: true });
  });
}

function integrationStatuses(settings: Record<string, SettingRecord>, draft: Record<string, string>) {
  const stripeOk = settings.STRIPE_SECRET_KEY?.status === 'configured' || Boolean(draft.STRIPE_SECRET_KEY?.trim());
  const emailMode = draft.EMAIL_DELIVERY_MODE || 'log';
  const emailOk = emailMode === 'log' || Boolean(draft.SMTP_HOST?.trim());
  const shippingProvider = draft.SHIPPING_PROVIDER || 'manual';
  const shippingOk = shippingProvider === 'manual' || settings.EASYPOST_API_KEY?.status === 'configured' || Boolean(draft.EASYPOST_API_KEY?.trim());
  const newsletterMode = draft.NEWSLETTER_DELIVERY_MODE || 'log';
  const newsletterOk = newsletterMode === 'log' || settings.MAILCHIMP_API_KEY?.status === 'configured';

  return [
    { label: 'Stripe payments', ok: stripeOk, detail: stripeOk ? 'Connected' : 'Add Stripe keys to accept payments' },
    { label: 'Email delivery', ok: emailOk, detail: emailMode === 'smtp' ? 'SMTP configured' : 'Log mode — emails are not sent' },
    { label: 'Shipping labels', ok: shippingOk, detail: shippingProvider === 'easypost' ? 'EasyPost ready' : 'Manual tracking only' },
    { label: 'Newsletter', ok: newsletterOk, detail: newsletterMode === 'mailchimp' ? 'Mailchimp configured' : 'Log mode' },
  ];
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, SettingRecord>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [siteContent, setSiteContent] = useState<SiteContentByPage | null>(null);

  useEffect(() => {
    loadSettings();
    fetch('/api/admin/site-content', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setSiteContent(data as SiteContentByPage);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading) return;
    focusSettingFieldFromHash();
    window.addEventListener('hashchange', focusSettingFieldFromHash);
    return () => window.removeEventListener('hashchange', focusSettingFieldFromHash);
  }, [loading]);

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

  async function runAutomationsNow() {
    setRunningAutomation(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/automation/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Automation run failed');
      setMessage(`Automations completed. Processed ${data.processed ?? 0} job(s).`);
      if (typeof data.lastRunAt === 'string' && data.lastRunAt) {
        setDraft((prev) => ({ ...prev, CRON_LAST_RUN_AT: data.lastRunAt }));
      }
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Automation run failed');
    } finally {
      setRunningAutomation(false);
    }
  }

  const statuses = useMemo(() => integrationStatuses(settings, draft), [settings, draft]);
  const setupSteps = useMemo(() => {
    const stripeOk = statuses.find((item) => item.label === 'Stripe payments')?.ok ?? false;
    const emailOk = statuses.find((item) => item.label === 'Email delivery')?.ok ?? false;
    const shippingOk = statuses.find((item) => item.label === 'Shipping labels')?.ok ?? false;
    const newsletterOk = statuses.find((item) => item.label === 'Newsletter')?.ok ?? false;
    const siteUrlOk = Boolean(draft.NEXT_PUBLIC_SITE_URL?.trim() || draft.NEXT_PUBLIC_BASE_URL?.trim());
    const contactOk = Boolean(draft.CONTACT_EMAIL?.trim() || draft.ARTIST_EMAIL?.trim());

    const siteCustomized = siteContent ? isSiteCustomizationComplete(siteContent) : false;

    return [
      { label: 'Set your public site URL', complete: siteUrlOk, href: adminSettingFieldHref('NEXT_PUBLIC_SITE_URL') },
      { label: 'Add a contact email for inquiries', complete: contactOk, href: adminSettingFieldHref('CONTACT_EMAIL') },
      { label: 'Customize look, pages, and legal copy', complete: siteCustomized, href: '/admin?tab=pages' },
      { label: 'Connect Stripe for checkout', complete: stripeOk, href: adminSettingFieldHref('STRIPE_SECRET_KEY') },
      { label: 'Configure email delivery', complete: emailOk, href: adminSettingFieldHref('EMAIL_DELIVERY_MODE') },
      { label: 'Set up shipping (manual or EasyPost)', complete: shippingOk, href: adminSettingFieldHref('SHIPPING_PROVIDER') },
      { label: 'Connect newsletter delivery', complete: newsletterOk, href: adminSettingFieldHref('NEWSLETTER_DELIVERY_MODE') },
    ];
  }, [statuses, draft, siteContent]);
  const setupCompleteCount = setupSteps.filter((step) => step.complete).length;
  const showSetupWizard = setupCompleteCount < setupSteps.length;

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

      {showSetupWizard && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Studio setup</h2>
              <p className="text-sm text-gray-700">{setupCompleteCount} of {setupSteps.length} essentials configured.</p>
            </div>
            <Link href="/admin?tab=pages" className="text-sm font-medium text-primary hover:opacity-80">
              Open Site Pages
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-white/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${step.complete ? 'bg-green-500' : 'bg-amber-400'}`} aria-hidden />
                  <span className="text-sm text-gray-900">{step.label}</span>
                </div>
                {!step.complete && (
                  <Link href={step.href} className="text-xs font-medium text-primary hover:opacity-80">
                    Configure
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Integration status</h2>
        <p className="mt-1 text-sm text-gray-600">Quick view of what is ready for customers.</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <li key={status.label} className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${status.ok ? 'bg-green-500' : 'bg-amber-400'}`} aria-hidden />
              <div>
                <p className="text-sm font-medium text-gray-900">{status.label}</p>
                <p className="text-xs text-gray-600">{status.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Automation status</h2>
        <p className="mt-1 text-sm text-gray-600">
          Last run: {draft.CRON_LAST_RUN_AT ? new Date(draft.CRON_LAST_RUN_AT).toLocaleString() : 'Not recorded yet'}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Cron URL: <code className="rounded bg-gray-100 px-1">{typeof window !== 'undefined' ? `${window.location.origin}/api/cron/marketing` : '/api/cron/marketing'}</code>
        </p>
        <button
          type="button"
          onClick={runAutomationsNow}
          disabled={runningAutomation}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {runningAutomation ? 'Running...' : 'Run automations now'}
        </button>
      </section>

      {SETTINGS_GROUPS.map((group) => {
        const body = (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {group.keys.map((field) => {
              const record = settings[field.key];
              return (
                <div key={field.key} id={adminSettingFieldId(field.key)} className="scroll-mt-24">
                  <label className="block text-sm font-medium text-gray-700">
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
                </div>
              );
            })}
          </div>
        );

        if (ADVANCED_GROUP_TITLES.has(group.title)) {
          return (
            <details key={group.title} className="rounded-lg border bg-white p-6">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900">{group.title}</summary>
              <p className="mt-2 text-sm text-gray-600">{group.description}</p>
              <div className="mt-5">{body}</div>
            </details>
          );
        }

        return (
          <section key={group.title} className="rounded-lg border bg-white p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{group.description}</p>
            </div>
            {body}
          </section>
        );
      })}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="rounded bg-gray-900 px-5 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}