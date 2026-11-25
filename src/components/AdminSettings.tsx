'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { isResendSandboxSender } from '@/lib/email-shell';

type SettingRecord = {
  key: string;
  value: string;
  status: 'configured' | 'not_set';
  secret: boolean;
};

type SettingFieldOption = { value: string; label: string };

type SettingField = {
  key: string;
  label: string;
  type?: string;
  help?: string;
  options?: SettingFieldOption[];
  defaultValue?: string;
  visibleWhen?: (draft: Record<string, string>) => boolean;
};

type SettingsGroup = {
  id: string;
  title: string;
  description: string;
  keys: SettingField[];
};

const BOOL_OPTIONS: SettingFieldOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

const isSmtpMode = (draft: Record<string, string>) => (draft.EMAIL_DELIVERY_MODE || 'log') === 'smtp';
const isMailchimpMode = (draft: Record<string, string>) => (draft.NEWSLETTER_DELIVERY_MODE || 'log') === 'mailchimp';
const isWinbackEnabled = (draft: Record<string, string>) => (draft.WINBACK_EMAIL_ENABLED || 'false') === 'true';
const isEasyPostMode = (draft: Record<string, string>) => (draft.SHIPPING_PROVIDER || 'manual') === 'easypost';
const isMetaSocial = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') === 'meta';
const isAyrshareSocial = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') === 'ayrshare';
const isAutoSocialCapable = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') !== 'assist';

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'access',
    title: 'Access',
    description: 'Control who can manage the site. Keep at least one working admin email here or in ADMIN_EMAILS.',
    keys: [
      { key: 'ADMIN_EMAILS', label: 'Admin emails', help: 'Comma-separated email addresses.' },
    ],
  },
  {
    id: 'site-identity',
    title: 'Site Identity',
    description: 'Public URLs, studio contact routing, and footer social profiles.',
    keys: [
      { key: 'NEXT_PUBLIC_SITE_URL', label: 'Public site URL', help: 'The address collectors use, such as https://yourstudio.com' },
      { key: 'NEXT_PUBLIC_BASE_URL', label: 'Application base URL', help: 'Usually the same as your public site URL.' },
      { key: 'CONTACT_EMAIL', label: 'Contact recipient email', help: 'Receives contact form submissions and studio inquiries.' },
      { key: 'ARTIST_EMAIL', label: 'Artist email', help: 'Receives internal studio notifications and new order alerts.' },
      { key: 'SUPPORT_EMAIL', label: 'Support email', help: 'Shown to collectors on receipts and shipping updates for help.' },
      { key: 'SOCIAL_INSTAGRAM_URL', label: 'Instagram profile URL', help: 'Shown in the site footer next to email. Leave blank to use the handle from Pages → Contact.' },
      { key: 'SOCIAL_FACEBOOK_URL', label: 'Facebook page URL' },
      { key: 'SOCIAL_X_URL', label: 'X profile URL' },
      { key: 'SOCIAL_PINTEREST_URL', label: 'Pinterest profile URL' },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    description: 'Stripe powers checkout. Secret fields stay encrypted and are never shown after saving.',
    keys: [
      { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key' },
      { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', type: 'password' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret', type: 'password' },
      {
        key: 'STRIPE_AUTOMATIC_TAX_ENABLED',
        label: 'Calculate tax automatically with Stripe',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
      },
    ],
  },
  {
    id: 'email-delivery',
    title: 'Email Delivery',
    description: 'SMTP sends contact and order-status emails. Use log mode until SMTP is ready.',
    keys: [
      {
        key: 'EMAIL_DELIVERY_MODE',
        label: 'Email delivery mode',
        options: [
          { value: 'log', label: 'Log only (safe for testing)' },
          { value: 'smtp', label: 'Send with SMTP' },
        ],
        defaultValue: 'log',
      },
      {
        key: 'WELCOME_EMAIL_ENABLED',
        label: 'Send welcome email to new collectors',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
      },
      { key: 'SMTP_HOST', label: 'SMTP host', visibleWhen: isSmtpMode },
      { key: 'SMTP_PORT', label: 'SMTP port', visibleWhen: isSmtpMode },
      { key: 'SMTP_USER', label: 'SMTP user', visibleWhen: isSmtpMode },
      { key: 'SMTP_PASSWORD', label: 'SMTP password', type: 'password', visibleWhen: isSmtpMode },
      { key: 'SMTP_FROM', label: 'From email', visibleWhen: isSmtpMode },
    ],
  },
  {
    id: 'newsletter',
    title: 'Newsletter',
    description: 'Newsletters you write in the Newsletter tab send through Email Delivery above. Signups can also be copied to Mailchimp.',
    keys: [
      {
        key: 'NEWSLETTER_FOOTER_ADDRESS',
        label: 'Mailing address for newsletter footer',
        help: 'Anti-spam law requires a postal address in every newsletter. A PO box works.',
      },
      {
        key: 'NEWSLETTER_DELIVERY_MODE',
        label: 'Signup copy',
        options: [
          { value: 'log', label: 'Keep signups on this site only' },
          { value: 'mailchimp', label: 'Also add signups to Mailchimp' },
        ],
        defaultValue: 'log',
      },
      { key: 'MAILCHIMP_API_KEY', label: 'Mailchimp API key', type: 'password', visibleWhen: isMailchimpMode },
      { key: 'MAILCHIMP_LIST_ID', label: 'Mailchimp list ID', visibleWhen: isMailchimpMode },
      { key: 'MAILCHIMP_SERVER_PREFIX', label: 'Mailchimp server prefix', visibleWhen: isMailchimpMode },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping',
    description: 'Manual carrier tracking always works. Switch to EasyPost only when you want in-site rates and labels.',
    keys: [
      {
        key: 'SHIPPING_PROVIDER',
        label: 'Shipping provider',
        options: [
          { value: 'manual', label: 'Manual tracking' },
          { value: 'easypost', label: 'EasyPost labels & rates' },
        ],
        defaultValue: 'manual',
        help: 'Manual remains the fallback if EasyPost is unavailable.',
      },
      { key: 'EASYPOST_API_KEY', label: 'EasyPost API key', type: 'password', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_NAME', label: 'Ship-from name', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_COMPANY', label: 'Ship-from company', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_STREET1', label: 'Ship-from street', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_STREET2', label: 'Ship-from apartment/suite', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_CITY', label: 'Ship-from city', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_STATE', label: 'Ship-from state/region', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_POSTAL_CODE', label: 'Ship-from postal code', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_COUNTRY', label: 'Ship-from country', help: 'Use a two-letter country code such as US.', visibleWhen: isEasyPostMode },
      { key: 'SHIP_FROM_PHONE', label: 'Ship-from phone', visibleWhen: isEasyPostMode },
      { key: 'SHIPPING_DEFAULT_PACKAGE_WEIGHT_OZ', label: 'Default package weight (oz)', visibleWhen: isEasyPostMode },
      { key: 'SHIPPING_DEFAULT_PACKAGE_LENGTH_IN', label: 'Default package length (in)', visibleWhen: isEasyPostMode },
      { key: 'SHIPPING_DEFAULT_PACKAGE_WIDTH_IN', label: 'Default package width (in)', visibleWhen: isEasyPostMode },
      { key: 'SHIPPING_DEFAULT_PACKAGE_HEIGHT_IN', label: 'Default package height (in)', visibleWhen: isEasyPostMode },
    ],
  },
  {
    id: 'marketing-signals',
    title: 'Marketing Signals',
    description: 'Optional measurement and social publishing credentials.',
    keys: [
      { key: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', label: 'GA4 measurement ID' },
      { key: 'GA_API_SECRET', label: 'GA4 API secret', type: 'password' },
      { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads customer ID' },
      { key: 'FACEBOOK_PIXEL_ID', label: 'Facebook pixel ID', help: 'Used for site analytics. Instagram Business posts use the Meta provider below.' },
      { key: 'FACEBOOK_CONVERSION_API_TOKEN', label: 'Facebook conversion API token', type: 'password' },
      { key: 'PINTEREST_ACCESS_TOKEN', label: 'Pinterest access token', type: 'password' },
      { key: 'PINTEREST_BOARD_ID', label: 'Pinterest board ID' },
      {
        key: 'SOCIAL_PROVIDER',
        label: 'Social publishing provider',
        options: [
          { value: 'assist', label: 'Assist (copy drafts for you)' },
          { value: 'meta', label: 'Meta (Facebook / Instagram)' },
          { value: 'ayrshare', label: 'Ayrshare (multi-platform)' },
        ],
        defaultValue: 'assist',
        help: 'Ayrshare is recommended when you publish to several networks.',
      },
      { key: 'FACEBOOK_ACCESS_TOKEN', label: 'Facebook access token', type: 'password', visibleWhen: isMetaSocial },
      { key: 'FACEBOOK_PAGE_ID', label: 'Facebook page ID', visibleWhen: isMetaSocial },
      { key: 'AYRSHARE_API_KEY', label: 'Ayrshare API key', type: 'password', visibleWhen: isAyrshareSocial },
      {
        key: 'SOCIAL_PUBLISH_MODE',
        label: 'Social publish mode',
        options: [
          { value: 'assist', label: 'Assist — review before posting' },
          { value: 'auto', label: 'Auto — publish on schedule' },
        ],
        defaultValue: 'assist',
        help: 'Assist is safest and works without platform credentials.',
        visibleWhen: isAutoSocialCapable,
      },
      { key: 'MARKETING_EMAIL_UNIT_COST', label: 'Estimated cost per email', help: 'Optional dollar amount used for ROI estimates. Leave blank or 0 for actual spend only.' },
      { key: 'MARKETING_SOCIAL_POST_COST', label: 'Estimated cost per social post', help: 'Optional dollar amount used for ROI estimates. Leave blank or 0 for actual spend only.' },
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    description: 'Built-in email automations (welcome series, win-back, cart recovery) and scheduled marketing jobs — all sent through Resend without Mailchimp.',
    keys: [
      { key: 'CRON_SECRET', label: 'Automation secret', type: 'password', help: 'Turns on automatic runs every 30 minutes and protects the scheduling URL.' },
      {
        key: 'NEWSLETTER_WELCOME_ENABLED',
        label: 'Send welcome email on newsletter signup',
        options: BOOL_OPTIONS,
        defaultValue: 'true',
        help: 'Sends a studio-branded welcome email immediately when someone subscribes via Resend SMTP.',
      },
      {
        key: 'NEWSLETTER_WELCOME_SERIES_ENABLED',
        label: 'Send Day-3 studio follow-up email',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
        help: 'Sends one follow-up note 3 days after newsletter signup introducing your portfolio and studio updates.',
      },
      {
        key: 'WINBACK_EMAIL_ENABLED',
        label: 'Send quiet win-back email to inactive subscribers',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
        help: 'Sends one gentle check-in note to opted-in subscribers who have not visited or ordered recently.',
      },
      {
        key: 'WINBACK_INACTIVE_DAYS',
        label: 'Win-back inactivity window (days)',
        defaultValue: '45',
        help: 'Minimum days since last visit, order, or signup before sending a win-back note (14–365).',
        visibleWhen: isWinbackEnabled,
      },
      {
        key: 'CART_ABANDONMENT_ENABLED',
        label: 'Send cart recovery emails',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
      },
      { key: 'CART_RECOVERY_PROMO_CODE', label: 'Cart recovery promo code', help: 'Optional existing promo code to include in recovery emails.' },
    ],
  },
];

const ADVANCED_GROUP_TITLES = new Set(['Marketing Signals', 'Automation']);
const EDITABLE_SETTING_KEYS = new Set<string>(
  SETTINGS_GROUPS.flatMap((group) => group.keys.map((field) => field.key)),
);
const GROUP_ID_BY_KEY = new Map<string, string>(
  SETTINGS_GROUPS.flatMap((group) => group.keys.map((field) => [field.key, group.id])),
);

const settingsFetcher = async (url: string): Promise<{ settings: SettingRecord[] }> => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to load settings');
  return data;
};

function scrollToSettingsElement(elementId: string): void {
  if (typeof window === 'undefined') return;
  let el = document.getElementById(elementId);
  if (!el && elementId.startsWith('setting-')) {
    const key = elementId.slice('setting-'.length);
    const groupId = GROUP_ID_BY_KEY.get(key);
    if (groupId) el = document.getElementById(`settings-group-${groupId}`);
  }
  if (!el) return;

  if (el instanceof HTMLDetailsElement) {
    el.open = true;
  }
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    if (parent.tagName === 'DETAILS') {
      (parent as HTMLDetailsElement).open = true;
    }
    parent = parent.parentElement;
  }

  requestAnimationFrame(() => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const input = el?.querySelector('input, textarea, select') as HTMLElement | null;
    input?.focus({ preventScroll: true });
  });
}

function buildEditableDraft(records: SettingRecord[]): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const item of records) {
    if (EDITABLE_SETTING_KEYS.has(item.key)) {
      raw[item.key] = item.value || '';
    }
  }
  return applySettingFieldDefaults(raw);
}

export function adminSettingFieldId(key: string): string {
  return `setting-${key}`;
}

export function adminSettingFieldHref(key: string): string {
  return `/admin?tab=settings#${adminSettingFieldId(key)}`;
}

function focusSettingFieldFromHash(): void {
  if (typeof window === 'undefined') return;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith('setting-') && !raw.startsWith('settings-group-')) return;
  scrollToSettingsElement(raw);
}

function fieldDraftValue(field: SettingField, draft: Record<string, string>): string {
  const current = draft[field.key];
  if (current != null && current !== '') return current;
  return field.defaultValue || '';
}

function applySettingFieldDefaults(values: Record<string, string>): Record<string, string> {
  const next = { ...values };
  for (const group of SETTINGS_GROUPS) {
    for (const field of group.keys) {
      if (!field.defaultValue) continue;
      if (next[field.key] == null || next[field.key] === '') {
        next[field.key] = field.defaultValue;
      }
    }
  }
  return next;
}

function integrationStatuses(settings: Record<string, SettingRecord>, draft: Record<string, string>) {
  const stripeOk = settings.STRIPE_SECRET_KEY?.status === 'configured' || Boolean(draft.STRIPE_SECRET_KEY?.trim());
  const emailMode = draft.EMAIL_DELIVERY_MODE || 'log';
  const emailSandboxSender = emailMode === 'smtp' && isResendSandboxSender(draft.SMTP_FROM);
  const emailOk = emailMode === 'smtp' && Boolean(draft.SMTP_HOST?.trim()) && !emailSandboxSender;
  const shippingProvider = draft.SHIPPING_PROVIDER || 'manual';
  const shippingOk = shippingProvider === 'manual' || settings.EASYPOST_API_KEY?.status === 'configured' || Boolean(draft.EASYPOST_API_KEY?.trim());
  const newsletterMode = draft.NEWSLETTER_DELIVERY_MODE || 'log';
  const newsletterAddressOk = Boolean(draft.NEWSLETTER_FOOTER_ADDRESS?.trim());
  const newsletterOk = newsletterAddressOk && (newsletterMode === 'log' || settings.MAILCHIMP_API_KEY?.status === 'configured');

  return [
    {
      label: 'Stripe payments',
      ok: stripeOk,
      detail: stripeOk ? 'Connected' : 'Add Stripe keys to accept payments',
      targetId: adminSettingFieldId('STRIPE_SECRET_KEY'),
    },
    {
      label: 'Email delivery',
      ok: emailOk,
      detail: emailMode === 'smtp'
        ? emailSandboxSender
          ? 'Sandbox sender (resend.dev) — verify your domain'
          : emailOk
            ? 'SMTP configured'
            : 'Add SMTP host to send emails'
        : 'Log mode — emails are not sent',
      targetId: adminSettingFieldId(emailSandboxSender ? 'SMTP_FROM' : 'EMAIL_DELIVERY_MODE'),
    },
    {
      label: 'Shipping labels',
      ok: shippingOk,
      detail: shippingProvider === 'easypost' ? 'EasyPost ready' : 'Manual tracking only',
      targetId: adminSettingFieldId('SHIPPING_PROVIDER'),
    },
    {
      label: 'Newsletter',
      ok: newsletterOk,
      detail: !newsletterAddressOk
        ? 'Add a footer mailing address'
        : newsletterMode === 'mailchimp' ? 'Signups copied to Mailchimp' : 'Ready — sends with Email delivery',
      targetId: adminSettingFieldId('NEWSLETTER_FOOTER_ADDRESS'),
    },
  ];
}

export default function AdminSettings() {
  const {
    data: settingsResponse,
    error: swrError,
    isLoading,
    mutate: mutateSettings,
  } = useSWR<{ settings: SettingRecord[] }>('/api/admin/settings', settingsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const [settings, setSettings] = useState<Record<string, SettingRecord>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedDraft, setSavedDraft] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!settingsResponse?.settings) return;
    const records = Object.fromEntries(settingsResponse.settings.map((item) => [item.key, item]));
    const nextDraft = buildEditableDraft(settingsResponse.settings);
    setSettings(records);
    setSavedDraft(nextDraft);
    setDraft((current) => (initialized ? current : nextDraft));
    setInitialized(true);
  }, [settingsResponse, initialized]);

  const loading = isLoading && !initialized;

  useEffect(() => {
    if (loading) return;
    focusSettingFieldFromHash();
    window.addEventListener('hashchange', focusSettingFieldFromHash);
    return () => window.removeEventListener('hashchange', focusSettingFieldFromHash);
  }, [loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const settingsPayload = applySettingFieldDefaults(
        Object.fromEntries(
          Object.entries(draft).filter(([key]) => EDITABLE_SETTING_KEYS.has(key)),
        ),
      );
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsPayload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save settings');
      const records = Object.fromEntries((data.settings || []).map((item: SettingRecord) => [item.key, item]));
      const nextDraft = buildEditableDraft(data.settings || []);
      setSettings(records);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      await mutateSettings(data, { revalidate: false });
      setMessage({ type: 'success', text: 'Settings saved. Secret values are hidden after saving.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save settings' });
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
      setMessage({ type: 'success', text: `Automations completed. Processed ${data.processed ?? 0} job(s).` });
      if (typeof data.lastRunAt === 'string' && data.lastRunAt) {
        setSettings((prev) => ({
          ...prev,
          CRON_LAST_RUN_AT: { key: 'CRON_LAST_RUN_AT', value: data.lastRunAt, status: 'configured', secret: false },
        }));
      }
      await mutateSettings();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Automation run failed' });
    } finally {
      setRunningAutomation(false);
    }
  }

  const statuses = useMemo(() => integrationStatuses(settings, draft), [settings, draft]);
  const isDirty = useMemo(
    () => Object.keys({ ...savedDraft, ...draft }).some((key) => (draft[key] || '') !== (savedDraft[key] || '')),
    [draft, savedDraft],
  );
  const displayMessage = message || (swrError instanceof Error ? { type: 'error' as const, text: swrError.message } : null);

  if (loading) {
    return <div className="rounded-lg border bg-white p-6 text-gray-600">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Configure access, payments, email, shipping, and optional integrations. Provider fields appear only when selected.
          </p>
        </div>
      </div>

      {/* Quick section jump pills */}
      <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5">
        {SETTINGS_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => scrollToSettingsElement(`settings-group-${group.id}`)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          >
            {group.title}
          </button>
        ))}
      </nav>

      {displayMessage && (
        <div
          role={displayMessage.type === 'error' ? 'alert' : 'status'}
          className={`rounded border p-3 text-sm ${
            displayMessage.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {displayMessage.text}
        </div>
      )}

      <section className="rounded-lg border bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Integration status</h3>
        <p className="mt-0.5 text-sm text-gray-600">Quick view of what is ready for customers.</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <li key={status.label} className="flex items-start justify-between gap-3 rounded-md border border-gray-200 p-3">
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status.ok ? 'bg-green-500' : 'bg-amber-400'}`} aria-hidden />
                <div>
                  <p className="text-sm font-medium text-gray-900">{status.label}</p>
                  <p className="text-xs text-gray-600">{status.detail}</p>
                </div>
              </div>
              {!status.ok && (
                <button
                  type="button"
                  onClick={() => scrollToSettingsElement(status.targetId)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Configure
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {SETTINGS_GROUPS.map((group) => {
        const visibleFields = group.keys.filter((field) => !field.visibleWhen || field.visibleWhen(draft));
        const body = (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleFields.map((field) => {
              const record = settings[field.key];
              return (
                <div key={field.key} id={adminSettingFieldId(field.key)} className="scroll-mt-28">
                  <label className="block text-sm font-medium text-gray-700">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span>{field.label}</span>
                      {record?.secret && (
                        <span className={record.status === 'configured' ? 'text-green-700' : 'text-gray-500'}>
                          {record.status === 'configured' ? 'Configured' : 'Not set'}
                        </span>
                      )}
                    </div>
                    {field.options ? (
                      <select
                        value={fieldDraftValue(field, draft)}
                        onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'multiline' ? (
                      <textarea
                        value={draft[field.key] || ''}
                        onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                        rows={8}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={draft[field.key] || ''}
                        placeholder={record?.secret && record.status === 'configured' ? 'Leave blank to keep current secret' : ''}
                        onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                      />
                    )}
                    {field.help && <p className="mt-1 text-xs text-gray-500">{field.help}</p>}
                    {field.key === 'SMTP_FROM'
                      && draft.EMAIL_DELIVERY_MODE !== 'log'
                      && isResendSandboxSender(draft.SMTP_FROM) && (
                        <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                          Resend&apos;s sandbox sender (<code>onboarding@resend.dev</code>) only delivers to your own Resend account email. Verify your domain at resend.com/domains and update this address (for example <code>hello@michalelena.art</code>) before emailing collectors.
                        </p>
                      )}
                  </label>
                </div>
              );
            })}
          </div>
        );

        if (ADVANCED_GROUP_TITLES.has(group.title)) {
          return (
            <details
              key={group.id}
              id={`settings-group-${group.id}`}
              className="scroll-mt-28 rounded-lg border bg-white p-6"
            >
              <summary className="cursor-pointer text-base font-semibold text-gray-900">{group.title}</summary>
              <p className="mt-2 text-sm text-gray-600">{group.description}</p>
              <div className="mt-5">{body}</div>
              {group.id === 'automation' && (
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-600">
                      Last run: {settings.CRON_LAST_RUN_AT?.value ? new Date(settings.CRON_LAST_RUN_AT.value).toLocaleString() : 'Not recorded yet'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void runAutomationsNow()}
                      disabled={runningAutomation}
                      className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {runningAutomation ? 'Running...' : 'Run automations now'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    External scheduler endpoint:{' '}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/cron/marketing` : '/api/cron/marketing'}
                    </code>
                  </p>
                </div>
              )}
            </details>
          );
        }

        return (
          <section
            key={group.id}
            id={`settings-group-${group.id}`}
            className="scroll-mt-28 rounded-lg border bg-white p-6"
          >
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900">{group.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{group.description}</p>
            </div>
            {body}
          </section>
        );
      })}

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm text-gray-600">
          {isDirty ? 'You have unsaved settings changes.' : 'All settings saved.'}
        </p>
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}