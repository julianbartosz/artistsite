'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useUnsavedChangesGuard } from '@/components/admin/useUnsavedChangesGuard';
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

type SettingsTabId = 'general' | 'commerce' | 'email' | 'integrations';

type SettingsGroup = {
  id: string;
  tab: SettingsTabId;
  title: string;
  description: string;
  keys: SettingField[];
};

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'commerce', label: 'Payments & Shipping' },
  { id: 'email', label: 'Email & Newsletter' },
  { id: 'integrations', label: 'Integrations' },
];

const BOOL_OPTIONS: SettingFieldOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

const isStripeCheckout = (draft: Record<string, string>) => (draft.CHECKOUT_MODE || 'manual') === 'stripe';
const isManualCheckout = (draft: Record<string, string>) => (draft.CHECKOUT_MODE || 'manual') === 'manual';
const isSmtpMode = (draft: Record<string, string>) => (draft.EMAIL_DELIVERY_MODE || 'log') === 'smtp';
const isMailchimpMode = (draft: Record<string, string>) => (draft.NEWSLETTER_DELIVERY_MODE || 'log') === 'mailchimp';
const isEasyPostMode = (draft: Record<string, string>) => (draft.SHIPPING_PROVIDER || 'manual') === 'easypost';
const hasGa4MeasurementId = (draft: Record<string, string>) => Boolean(draft.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim());
const hasFacebookPixelId = (draft: Record<string, string>) => Boolean(draft.FACEBOOK_PIXEL_ID?.trim());
const isMetaSocial = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') === 'meta';
const isAyrshareSocial = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') === 'ayrshare';
const isAutoSocialCapable = (draft: Record<string, string>) => (draft.SOCIAL_PROVIDER || 'assist') !== 'assist';

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'access',
    tab: 'general',
    title: 'Access',
    description: 'Control who can manage the site. Keep at least one working admin email here or in ADMIN_EMAILS.',
    keys: [
      { key: 'ADMIN_EMAILS', label: 'Admin emails', help: 'Comma-separated email addresses.' },
    ],
  },
  {
    id: 'site-identity',
    tab: 'general',
    title: 'Site Identity',
    description: 'Public URL, studio contact routing, and footer social profiles.',
    keys: [
      { key: 'NEXT_PUBLIC_SITE_URL', label: 'Public site URL', help: 'The address collectors use, such as https://yourstudio.com' },
      { key: 'CONTACT_EMAIL', label: 'Contact recipient email', help: 'Receives contact form submissions and studio inquiries.' },
      { key: 'ARTIST_EMAIL', label: 'Artist email', help: 'Receives internal studio notifications and new order alerts.' },
      { key: 'SUPPORT_EMAIL', label: 'Support email', help: 'Shown to collectors on receipts and shipping updates for help.' },
      { key: 'SOCIAL_INSTAGRAM_URL', label: 'Instagram profile URL', help: 'Shown in the site footer next to email. Leave blank to use the handle from Site → Pages → Contact.' },
      { key: 'SOCIAL_FACEBOOK_URL', label: 'Facebook page URL' },
      { key: 'SOCIAL_X_URL', label: 'X profile URL' },
      { key: 'SOCIAL_PINTEREST_URL', label: 'Pinterest profile URL' },
    ],
  },
  {
    id: 'commissions-licensing',
    tab: 'general',
    title: 'Commissions & Licensing',
    description: 'Control whether custom commissions are open on Contact and Shop, set your default artwork license, and schedule studio turnaround blackout dates.',
    keys: [
      {
        key: 'COMMISSION_STATUS',
        label: 'Commission availability',
        defaultValue: 'open',
        options: [
          { value: 'open', label: 'Open (accepting commission inquiries)' },
          { value: 'waitlist', label: 'Waitlist (collect waitlist signups instead)' },
          { value: 'closed', label: 'Closed (hide commission requests)' },
        ],
        help: 'Updates Contact and Shop automatically. Waitlist signups save to Grow → Newsletter under the commission_waitlist segment.',
      },
      {
        key: 'COMMISSION_WAITLIST_NOTE',
        label: 'Availability note (optional)',
        help: 'Shown on Contact and Shop (for example, "Booking Q2 2027" or "2 spots left for spring").',
      },
      {
        key: 'DEFAULT_LICENSE_TYPE',
        label: 'Default artwork license',
        defaultValue: 'personal',
        options: [
          { value: 'personal', label: 'Personal Display (default for collectors)' },
          { value: 'commercial', label: 'Commercial License' },
          { value: 'exclusive', label: 'Exclusive Buyout' },
        ],
        help: 'Applied by default to new commission proposals and Certificates of Authenticity.',
      },
      {
        key: 'STUDIO_BLACKOUT_START',
        label: 'Turnaround blackout start (optional)',
        type: 'date',
        help: 'Vacation, show week, or studio break start date. Quoted job due dates automatically shift past blackout windows.',
      },
      {
        key: 'STUDIO_BLACKOUT_END',
        label: 'Turnaround blackout end (optional)',
        type: 'date',
        help: 'Last day of studio blackout window.',
      },
    ],
  },
  {
    id: 'payments',
    tab: 'commerce',
    title: 'Payments',
    description: 'Accept manual purchase requests with zero setup, or connect Stripe for instant card checkout.',
    keys: [
      {
        key: 'CHECKOUT_MODE',
        label: 'Checkout mode',
        options: [
          { value: 'manual', label: 'Manual purchase requests (no Stripe needed)' },
          { value: 'stripe', label: 'Stripe card checkout' },
        ],
        help: 'Manual mode lets collectors submit purchase requests straight into Orders & Inbox so you can collect payment via Venmo, Zelle, invoice, or studio pickup.',
      },
      {
        key: 'MANUAL_PAYMENT_INSTRUCTIONS',
        label: 'Payment instructions shown at checkout',
        visibleWhen: isManualCheckout,
        help: 'Optional note shown on the review and confirmation screens (for example, which payment methods you accept or how fast you reply).',
      },
      { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key', visibleWhen: isStripeCheckout },
      { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', type: 'password', visibleWhen: isStripeCheckout },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret', type: 'password', visibleWhen: isStripeCheckout },
      {
        key: 'STRIPE_AUTOMATIC_TAX_ENABLED',
        label: 'Calculate tax automatically with Stripe',
        options: BOOL_OPTIONS,
        defaultValue: 'false',
        visibleWhen: isStripeCheckout,
        help: 'Leave off to include tax in your artwork prices, or turn on after enabling Stripe Tax in your Stripe dashboard.',
      },
    ],
  },
  {
    id: 'shipping',
    tab: 'commerce',
    title: 'Shipping',
    description: 'Collectors pay each product’s flat shipping rate at checkout. Fulfill manually with any carrier, or switch to EasyPost to compare live rates and buy printable PDF labels in Orders.',
    keys: [
      {
        key: 'SHIPPING_PROVIDER',
        label: 'Shipping provider',
        options: [
          { value: 'manual', label: 'Manual tracking' },
          { value: 'easypost', label: 'EasyPost in-site labels' },
        ],
        defaultValue: 'manual',
        help: 'Manual works with Pirate Ship, USPS, UPS, or any carrier. EasyPost adds rate comparison and PDF label purchase in Shop → Orders.',
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
    id: 'email-delivery',
    tab: 'email',
    title: 'Email Delivery',
    description: 'Contact inquiries and order notes always save to Studio Inbox. Connect SMTP when you want automated order confirmations, replies, and newsletters sent from your site.',
    keys: [
      {
        key: 'EMAIL_DELIVERY_MODE',
        label: 'Email delivery mode',
        options: [
          { value: 'log', label: 'Off — manual only (inquiries still save to Studio Inbox)' },
          { value: 'smtp', label: 'Send emails with SMTP' },
        ],
        defaultValue: 'log',
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
    tab: 'email',
    title: 'Newsletter',
    description: 'Newsletters you write in Grow → Newsletter send through Email Delivery above. Signups can also be copied to Mailchimp.',
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
    id: 'marketing-signals',
    tab: 'integrations',
    title: 'Analytics & Social Publishing',
    description: 'Built-in Studio analytics already work with zero setup. Add GA4, Meta Pixel, or social auto-publishing only when you want external tracking or direct posting.',
    keys: [
      { key: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', label: 'GA4 measurement ID', help: 'Optional Google Analytics 4 ID (for example G-XXXXXXXXXX).' },
      { key: 'GA_API_SECRET', label: 'GA4 API secret', type: 'password', help: 'Optional — forwards server-side Core Web Vitals to GA4.', visibleWhen: hasGa4MeasurementId },
      { key: 'FACEBOOK_PIXEL_ID', label: 'Facebook pixel ID', help: 'Optional — tracks storefront visits in Meta Events Manager.' },
      { key: 'FACEBOOK_CONVERSION_API_TOKEN', label: 'Facebook conversion API token', type: 'password', help: 'Optional — sends server-side Stripe purchase events to Meta.', visibleWhen: hasFacebookPixelId },
      {
        key: 'SOCIAL_PROVIDER',
        label: 'Social publishing provider',
        options: [
          { value: 'assist', label: 'Assist — copy drafts & open platform' },
          { value: 'meta', label: 'Meta (Facebook / Instagram)' },
          { value: 'ayrshare', label: 'Ayrshare (multi-platform)' },
        ],
        defaultValue: 'assist',
        help: 'Assist works out of the box with no API keys. Connect Meta or Ayrshare only if you want hands-off auto-publishing.',
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
    id: 'scheduler',
    tab: 'integrations',
    title: 'External Scheduler (Optional)',
    description: 'Built-in automations and scheduled newsletters run automatically while your site is online. Only add a cron secret if you trigger them from an external scheduler.',
    keys: [
      {
        key: 'CRON_SECRET',
        label: 'External cron secret (optional)',
        type: 'password',
        help: 'Optional — only needed if you wire an external cron service to /api/cron/marketing. Built-in scheduling works without it.',
      },
    ],
  },
];

const EDITABLE_SETTING_KEYS = new Set<string>(
  SETTINGS_GROUPS.flatMap((group) => group.keys.map((field) => field.key)),
);
const GROUP_BY_ID = new Map<string, SettingsGroup>(
  SETTINGS_GROUPS.map((group) => [group.id, group]),
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

function resolveTabForTarget(elementId: string): SettingsTabId | null {
  if (elementId.startsWith('setting-')) {
    const key = elementId.slice('setting-'.length);
    const groupId = GROUP_ID_BY_KEY.get(key);
    return groupId ? (GROUP_BY_ID.get(groupId)?.tab ?? null) : null;
  }
  if (elementId.startsWith('settings-group-')) {
    const groupId = elementId.slice('settings-group-'.length);
    if (groupId === 'automation') return 'integrations';
    return GROUP_BY_ID.get(groupId)?.tab ?? null;
  }
  return null;
}

function scrollAndFocusElement(elementId: string): void {
  if (typeof window === 'undefined') return;
  let el = document.getElementById(elementId);
  if (!el && elementId.startsWith('setting-')) {
    const key = elementId.slice('setting-'.length);
    const groupId = GROUP_ID_BY_KEY.get(key);
    if (groupId) el = document.getElementById(`settings-group-${groupId}`);
  }
  if (!el) return;

  requestAnimationFrame(() => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el?.querySelector('input, textarea, select') as HTMLElement | null;
    input?.focus({ preventScroll: true });
  });
}

function buildEditableDraft(records: SettingRecord[]): Record<string, string> {
  const raw: Record<string, string> = {};
  const byKey = new Map(records.map((item) => [item.key, item]));
  for (const item of records) {
    if (EDITABLE_SETTING_KEYS.has(item.key)) {
      raw[item.key] = item.value || '';
    }
  }
  if (!raw.CHECKOUT_MODE) {
    const hasStripeKeys =
      byKey.get('STRIPE_SECRET_KEY')?.status === 'configured'
      && byKey.get('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')?.status === 'configured';
    raw.CHECKOUT_MODE = hasStripeKeys ? 'stripe' : 'manual';
  }
  return applySettingFieldDefaults(raw);
}

export function adminSettingFieldId(key: string): string {
  return `setting-${key}`;
}

export function adminSettingFieldHref(key: string): string {
  return `/admin?tab=settings#${adminSettingFieldId(key)}`;
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
  const checkoutMode = draft.CHECKOUT_MODE || 'manual';
  const hasStripeSecret = settings.STRIPE_SECRET_KEY?.status === 'configured' || Boolean(draft.STRIPE_SECRET_KEY?.trim());
  const hasStripePublishable =
    settings.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.status === 'configured'
    || Boolean(draft.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
  const stripeReady = hasStripeSecret && hasStripePublishable;
  const paymentsOk = checkoutMode === 'manual' || stripeReady;

  const emailMode = draft.EMAIL_DELIVERY_MODE || 'log';
  const emailSandboxSender = emailMode === 'smtp' && isResendSandboxSender(draft.SMTP_FROM);
  const smtpComplete = Boolean(
    draft.SMTP_HOST?.trim()
    && draft.SMTP_USER?.trim()
    && (settings.SMTP_PASSWORD?.status === 'configured' || draft.SMTP_PASSWORD?.trim()),
  );
  const emailOk = emailMode === 'smtp' && smtpComplete && !emailSandboxSender;
  const shippingProvider = draft.SHIPPING_PROVIDER || 'manual';
  const easyPostHasKey = settings.EASYPOST_API_KEY?.status === 'configured' || Boolean(draft.EASYPOST_API_KEY?.trim());
  const easyPostHasReturnAddress = Boolean(
    (draft.SHIP_FROM_NAME?.trim() || draft.SHIP_FROM_COMPANY?.trim()) &&
    draft.SHIP_FROM_STREET1?.trim() &&
    draft.SHIP_FROM_CITY?.trim() &&
    draft.SHIP_FROM_STATE?.trim() &&
    draft.SHIP_FROM_POSTAL_CODE?.trim()
  );
  const shippingOk = shippingProvider === 'manual' || (easyPostHasKey && easyPostHasReturnAddress);
  const newsletterMode = draft.NEWSLETTER_DELIVERY_MODE || 'log';
  const newsletterAddressOk = Boolean(draft.NEWSLETTER_FOOTER_ADDRESS?.trim());
  const mailchimpReady = Boolean(
    (settings.MAILCHIMP_API_KEY?.status === 'configured' || draft.MAILCHIMP_API_KEY?.trim())
    && draft.MAILCHIMP_LIST_ID?.trim()
    && draft.MAILCHIMP_SERVER_PREFIX?.trim()
  );
  const newsletterOk = newsletterAddressOk && (newsletterMode === 'log' || mailchimpReady);

  return [
    {
      label: 'Payments',
      ok: paymentsOk,
      detail: checkoutMode === 'manual'
        ? 'Manual purchase requests'
        : stripeReady
          ? 'Stripe connected'
          : !hasStripePublishable
            ? 'Add Stripe publishable key'
            : 'Add Stripe secret key',
      targetId: adminSettingFieldId(
        checkoutMode === 'manual'
          ? 'CHECKOUT_MODE'
          : !hasStripePublishable
            ? 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
            : 'STRIPE_SECRET_KEY',
      ),
    },
    {
      label: 'Email delivery',
      ok: emailOk,
      detail: emailMode === 'smtp'
        ? emailSandboxSender
          ? 'Sandbox sender (resend.dev): verify your domain'
          : emailOk
            ? 'SMTP ready'
            : 'Finish SMTP host, user, and password'
        : 'Off (inquiries save to Studio Inbox)',
      targetId: adminSettingFieldId(
        emailSandboxSender
          ? 'SMTP_FROM'
          : emailMode === 'smtp' && !smtpComplete
            ? (!draft.SMTP_HOST?.trim() ? 'SMTP_HOST' : !draft.SMTP_USER?.trim() ? 'SMTP_USER' : 'SMTP_PASSWORD')
            : 'EMAIL_DELIVERY_MODE',
      ),
    },
    {
      label: 'Shipping labels',
      ok: shippingOk,
      detail: shippingProvider !== 'easypost'
        ? 'Manual tracking'
        : !easyPostHasKey
          ? 'Add EasyPost API key'
          : !easyPostHasReturnAddress
            ? 'Add ship-from return address'
            : 'EasyPost labels ready',
      targetId: adminSettingFieldId(
        shippingProvider !== 'easypost'
          ? 'SHIPPING_PROVIDER'
          : !easyPostHasKey
            ? 'EASYPOST_API_KEY'
            : 'SHIP_FROM_STREET1'
      ),
    },
    {
      label: 'Newsletter',
      ok: newsletterOk,
      detail: !newsletterAddressOk
        ? 'Add a footer mailing address'
        : newsletterMode === 'mailchimp'
          ? mailchimpReady
            ? 'Signups copied to Mailchimp'
            : 'Finish Mailchimp key, list ID, and server prefix (site signups still work)'
          : 'Ready (sends with Email delivery)',
      targetId: adminSettingFieldId(
        !newsletterAddressOk
          ? 'NEWSLETTER_FOOTER_ADDRESS'
          : newsletterMode === 'mailchimp' && !mailchimpReady
            ? 'MAILCHIMP_API_KEY'
            : 'NEWSLETTER_FOOTER_ADDRESS'
      ),
    },
  ];
}

export default function AdminSettings({
  onSelectTab,
}: {
  onSelectTab?: (tab: string) => void;
} = {}) {
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
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>('general');
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [copiedCronUrl, setCopiedCronUrl] = useState(false);
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

  const clearSettingsHash = useCallback(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  const jumpToSettingTarget = useCallback((elementId: string) => {
    const targetTab = resolveTabForTarget(elementId);
    if (targetTab) {
      setActiveSettingsTab(targetTab);
    }
    setPendingFocusId(elementId);
  }, []);

  useEffect(() => {
    if (loading || !pendingFocusId) return;
    const target = pendingFocusId;
    setPendingFocusId(null);
    requestAnimationFrame(() => scrollAndFocusElement(target));
  }, [loading, activeSettingsTab, pendingFocusId]);

  useEffect(() => {
    if (loading) return;
    const syncFromHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw.startsWith('setting-') && !raw.startsWith('settings-group-')) return;
      jumpToSettingTarget(raw);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [loading, jumpToSettingTarget]);

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

  async function sendTestEmail() {
    setTestingEmail(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test_email' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test email');
      setMessage({ type: 'success', text: `Test email sent to ${data.to}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send test email' });
    } finally {
      setTestingEmail(false);
    }
  }

  const statuses = useMemo(() => integrationStatuses(settings, draft), [settings, draft]);

  const dirtyTabs = useMemo(() => {
    const dirty = new Set<SettingsTabId>();
    for (const group of SETTINGS_GROUPS) {
      if (group.keys.some((field) => (draft[field.key] || '') !== (savedDraft[field.key] || ''))) {
        dirty.add(group.tab);
      }
    }
    return dirty;
  }, [draft, savedDraft]);

  const isDirty = dirtyTabs.size > 0;
  useUnsavedChangesGuard(isDirty);
  const displayMessage = message || (swrError instanceof Error ? { type: 'error' as const, text: swrError.message } : null);
  const visibleGroups = useMemo(
    () => SETTINGS_GROUPS.filter((group) => group.tab === activeSettingsTab),
    [activeSettingsTab],
  );

  if (loading) {
    return <div className="rounded-lg border bg-white p-6 text-gray-600">Loading settings...</div>;
  }

  const cronEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/cron/marketing`
    : '/api/cron/marketing';

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

      {displayMessage && (
        <div
          role={displayMessage.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border p-3.5 text-sm ${
            displayMessage.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {displayMessage.text}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Integration status</h3>
        <p className="mt-0.5 text-sm text-gray-600">Quick view of what is ready for customers.</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statuses.map((status) => (
            <li key={status.label} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status.ok ? 'bg-green-500' : 'bg-amber-400'}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{status.label}</p>
                  <p className="text-xs text-gray-600">{status.detail}</p>
                </div>
              </div>
              {!status.ok && (
                <button
                  type="button"
                  onClick={() => jumpToSettingTarget(status.targetId)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Configure
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Settings category tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => {
          const active = activeSettingsTab === tab.id;
          const hasUnsaved = dirtyTabs.has(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                clearSettingsHash();
                setActiveSettingsTab(tab.id);
              }}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              {hasUnsaved && (
                <span
                  className={`h-2 w-2 rounded-full ${active ? 'bg-amber-300' : 'bg-amber-500'}`}
                  aria-label="Unsaved changes"
                />
              )}
            </button>
          );
        })}
      </div>

      {visibleGroups.map((group) => {
        const visibleFields = group.keys.filter((field) => !field.visibleWhen || field.visibleWhen(draft));
        return (
          <section
            key={group.id}
            id={`settings-group-${group.id}`}
            className="scroll-mt-28 rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900">{group.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleFields.map((field) => {
                const record = settings[field.key];
                return (
                  <div key={field.key} id={adminSettingFieldId(field.key)} className="scroll-mt-28">
                    <label className="block text-sm font-medium text-gray-700">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span>{field.label}</span>
                        {record?.secret && (
                          <span className={record.status === 'configured' ? 'text-xs text-green-700' : 'text-xs text-gray-500'}>
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
                            Resend&apos;s sandbox sender (<code>onboarding@resend.dev</code>) only delivers to your own Resend account email. Verify your domain at resend.com/domains and update this address before emailing collectors.
                          </p>
                        )}
                    </label>
                  </div>
                );
              })}
            </div>

            {group.id === 'email-delivery' && isSmtpMode(draft) && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500">
                  {isDirty
                    ? 'Save settings first, then send a test email to verify your SMTP credentials.'
                    : 'Send a quick test email to your signed-in admin address using your saved SMTP settings.'}
                </p>
                <button
                  type="button"
                  onClick={() => void sendTestEmail()}
                  disabled={testingEmail || isDirty}
                  className="rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  {testingEmail ? 'Sending test…' : 'Send test email'}
                </button>
              </div>
            )}

            {group.id === 'scheduler' && (
              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Email automations</p>
                    <p className="text-xs text-gray-600">
                      Turn automations on or off, customize templates, and trigger manual runs under Grow → Automations.
                    </p>
                  </div>
                  {onSelectTab ? (
                    <button
                      type="button"
                      onClick={() => onSelectTab('automations')}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Open Automations →
                    </button>
                  ) : (
                    <Link
                      href="/admin?tab=automations"
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Open Automations →
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    External scheduler endpoint:{' '}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{cronEndpoint}</code>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(cronEndpoint);
                      setCopiedCronUrl(true);
                      window.setTimeout(() => setCopiedCronUrl(false), 2000);
                    }}
                    className="font-medium text-gray-700 underline hover:text-gray-900"
                  >
                    {copiedCronUrl ? 'Copied' : 'Copy endpoint'}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <div
        className={`${
          isDirty ? 'sticky bottom-20 md:bottom-4 z-20 shadow-md border-gray-300' : 'border-gray-200 shadow-sm'
        } flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white/95 px-4 py-3 backdrop-blur`}
      >
        <p className="text-sm text-gray-600">
          {isDirty ? 'You have unsaved settings changes.' : 'All settings saved.'}
        </p>
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
