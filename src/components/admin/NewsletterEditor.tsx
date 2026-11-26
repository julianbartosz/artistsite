'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminSettingFieldHref } from '@/components/AdminSettings';
import MediaImageField from '@/components/admin/MediaImageField';
import { EditorSection, HtmlField, TextField, reorder } from '@/components/admin/EditorFields';
import { useUnsavedChangesGuard } from '@/components/admin/useUnsavedChangesGuard';
import { formatPrice } from '@/lib/commerce';
import { isResendSandboxSender } from '@/lib/email-shell';
import { pickVariantUrl } from '@/lib/image-variant-url';
import {
  AUTOMATION_EMAIL_IDS,
  NEWSLETTER_BLOCK_LABELS,
  applyMergeFields,
  createNewsletterBlock,
  createNewsletterDraft,
  mergeFieldToken,
  mergeFieldsForAudience,
  newsletterContentIssues,
  newsletterMergeValues,
  newsletterSendIssues,
  personalizeNewsletter,
  renderNewsletter,
  type AutomationAudienceKind,
  type AutomationEmailSummary,
  type NewsletterAdminContext,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterDocument,
  type NewsletterIssue,
  type NewsletterRenderContext,
  type NewsletterStatus,
  type NewsletterSummary,
} from '@/lib/newsletter';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export class NewsletterRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function newsletterRequest<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new NewsletterRequestError(typeof data.error === 'string' ? data.error : 'Something went wrong. Try again.', response.status);
  }
  return data as T;
}

type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;

/** Runs one action at a time; a 409 means the newsletter changed elsewhere (cron send, another tab), so `onStale` reloads it. */
function useNewsletterAction<A extends string>(onStale: () => void, initialNotice: Notice = null) {
  const [busy, setBusy] = useState<A | null>(null);
  const [notice, setNotice] = useState<Notice>(initialNotice);

  async function run(action: A, task: () => Promise<void>) {
    setBusy(action);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error) });
      if (error instanceof NewsletterRequestError && error.status === 409) onStale();
    } finally {
      setBusy(null);
    }
  }

  return { busy, notice, setNotice, run };
}

const NOTICE_CLASSES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
} as const;

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div role="status" className={`rounded border p-3 text-sm ${NOTICE_CLASSES[notice.tone]}`}>{notice.text}</div>;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

const STATUS_BADGES: Record<NewsletterStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-800' },
  active: { label: 'Sending', className: 'bg-amber-100 text-amber-800' },
  paused: { label: 'Needs attention', className: 'bg-red-50 text-red-700' },
  completed: { label: 'Sent', className: 'bg-green-50 text-green-800' },
};

export function NewsletterStatusBadge({ status }: { status: NewsletterStatus }) {
  const badge = STATUS_BADGES[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>;
}

export function formatNewsletterDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function subscriberLabel(count: number): string {
  return `${count.toLocaleString()} subscriber${count === 1 ? '' : 's'}`;
}

const SETTING_FOR_ISSUE: Record<string, string> = {
  'site-url': 'NEXT_PUBLIC_SITE_URL',
  address: 'NEWSLETTER_FOOTER_ADDRESS',
  delivery: 'EMAIL_DELIVERY_MODE',
  'sandbox-sender': 'SMTP_FROM',
  scheduler: 'CRON_SECRET',
};

function blockElementId(blockId: string): string {
  return `newsletter-block-${blockId}`;
}

// ---------------------------------------------------------------------------
// Inbox preview
// ---------------------------------------------------------------------------

function previewRenderContext(
  context: NewsletterAdminContext,
  audienceKind: AutomationAudienceKind = 'subscriber',
): NewsletterRenderContext {
  if (audienceKind === 'checkout') {
    return {
      ...context,
      footerReason: `You are receiving this reminder because you began checking out at ${context.siteName}.`,
      includeUnsubscribe: false,
    };
  }
  return context;
}

function previewMergeValues(
  context: NewsletterAdminContext,
  audienceKind: AutomationAudienceKind = 'subscriber',
  promoCode?: string,
) {
  const baseUrl = context.siteUrl ? context.siteUrl.replace(/\/$/, '') : 'https://example.com';
  return newsletterMergeValues(
    context.testRecipient,
    context,
    '#',
    audienceKind === 'checkout'
      ? {
          checkout_url: `${baseUrl}/checkout`,
          promo_code: promoCode?.trim() || 'STUDIO10',
        }
      : undefined,
  );
}

function renderPreviewHtml(
  document: NewsletterDocument,
  context: NewsletterAdminContext,
  audienceKind: AutomationAudienceKind = 'subscriber',
  promoCode?: string,
) {
  const renderContext = previewRenderContext(context, audienceKind);
  const rendered = personalizeNewsletter(
    renderNewsletter(document, renderContext),
    previewMergeValues(context, audienceKind, promoCode),
  );
  return { ...rendered, html: rendered.html.replace('<head>', '<head><base target="_blank">') };
}

export function NewsletterPreview({
  document,
  context,
  dirty = false,
  audienceKind = 'subscriber',
  promoCode,
}: {
  document: NewsletterDocument;
  context: NewsletterAdminContext;
  dirty?: boolean;
  audienceKind?: AutomationAudienceKind;
  promoCode?: string;
}) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [rendered, setRendered] = useState(() => renderPreviewHtml(document, context, audienceKind, promoCode));

  useEffect(() => {
    const timer = setTimeout(() => setRendered(renderPreviewHtml(document, context, audienceKind, promoCode)), 250);
    return () => clearTimeout(timer);
  }, [document, context, audienceKind, promoCode]);

  const viewer = context.testRecipient.firstName || context.testRecipient.email;
  const preheader = applyMergeFields(document.preheader.trim(), previewMergeValues(context, audienceKind, promoCode), 'text');

  return (
    <div className="rounded-lg border bg-white overflow-hidden xl:sticky xl:top-4">
      <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Inbox preview</h3>
          <p className="text-xs text-gray-500">{viewer ? `Personalized as ${viewer}.` : 'Updates as you edit.'}</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs font-medium text-amber-700">Unsaved changes</span>}
          {open && (
            <div className="flex rounded-md border border-gray-300 text-xs" role="group" aria-label="Preview width">
              {(['desktop', 'mobile'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWidth(option)}
                  aria-pressed={width === option}
                  className={`px-2.5 py-1 capitalize first:rounded-l-md last:rounded-r-md ${width === option ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
            aria-expanded={open}
          >
            {open ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
      </div>
      {open && (
        <>
          <div className="border-b bg-gray-50 px-4 py-3 text-sm">
            <p className="font-semibold text-gray-900">{document.fromName.trim() || context.siteName}</p>
            <p className="truncate text-gray-900">{rendered.subject || <span className="text-gray-400">No subject</span>}</p>
            {preheader && <p className="truncate text-gray-500">{preheader}</p>}
          </div>
          <div className="bg-gray-100">
            <iframe
              title="Newsletter preview"
              srcDoc={rendered.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className={`mx-auto block h-[min(70vh,720px)] bg-white transition-[width] ${width === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'}`}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const BLOCK_ORDER: NewsletterBlockType[] = ['text', 'image', 'button', 'product', 'divider'];
const MAX_BLOCKS = 40;

function mergeFieldOptionsFor(audienceKind: AutomationAudienceKind = 'subscriber') {
  return mergeFieldsForAudience(audienceKind).map((field) => ({ token: mergeFieldToken(field.key), label: field.label }));
}

type ProductOption = { id: string; title: string; price: number; currency: string; availability: string; images: unknown };

function productImage(images: unknown): string {
  const record = typeof images === 'string' ? safeJson(images) : images;
  if (!record || typeof record !== 'object') return '';
  const { thumbnail, gallery } = record as { thumbnail?: unknown; gallery?: unknown };
  const first = typeof thumbnail === 'string' && thumbnail.trim()
    ? thumbnail
    : Array.isArray(gallery) ? gallery.find((item): item is string => typeof item === 'string' && Boolean(item.trim())) ?? '' : '';
  return first ? pickVariantUrl(first, 'md') : '';
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function MergeFieldMenu({
  onInsert,
  audienceKind = 'subscriber',
}: {
  onInsert: (token: string) => void;
  audienceKind?: AutomationAudienceKind;
}) {
  const options = mergeFieldOptionsFor(audienceKind);
  return (
    <select
      aria-label="Insert personalization field"
      value=""
      onChange={(event) => {
        if (event.target.value) onInsert(event.target.value);
      }}
      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700"
    >
      <option value="">Insert field…</option>
      {options.map((field) => <option key={field.token} value={field.token}>{field.label}</option>)}
    </select>
  );
}

function appendToken(value: string, token: string): string {
  return value && !value.endsWith(' ') ? `${value} ${token}` : `${value}${token}`;
}

function BlockFields({
  block,
  onChange,
  products,
  audienceKind = 'subscriber',
}: {
  block: NewsletterBlock;
  onChange: (block: NewsletterBlock) => void;
  products: ProductOption[] | null;
  audienceKind?: AutomationAudienceKind;
}) {
  switch (block.type) {
    case 'text':
      return <HtmlField label="Text" value={block.html} onChange={(html) => onChange({ ...block, html })} mergeFields={mergeFieldOptionsFor(audienceKind)} />;
    case 'image':
      return (
        <div className="space-y-4">
          <MediaImageField label="Image" value={block.url} onChange={(url) => onChange({ ...block, url })} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Description for screen readers" value={block.alt} onChange={(alt) => onChange({ ...block, alt })} maxLength={300} />
            <TextField label="Caption" value={block.caption} onChange={(caption) => onChange({ ...block, caption })} maxLength={300} placeholder="Optional" />
          </div>
          <TextField label="Link" value={block.href} onChange={(href) => onChange({ ...block, href })} placeholder="Optional — https://… or /shop" />
        </div>
      );
    case 'button':
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Button label" value={block.label} onChange={(label) => onChange({ ...block, label })} maxLength={80} placeholder="See the new work" />
          <TextField
            label="Link"
            value={block.href}
            onChange={(href) => onChange({ ...block, href })}
            placeholder={audienceKind === 'checkout' ? '{{checkout_url}} or /shop' : 'https://… or /portfolio'}
          />
        </div>
      );
    case 'product': {
      const selected = products?.find((product) => product.id === block.productId);
      return (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Artwork
            <select
              value={block.productId}
              disabled={products === null}
              onChange={(event) => {
                const product = products?.find((option) => option.id === event.target.value);
                if (!product) {
                  onChange({ ...block, productId: '', title: '', imageUrl: '', priceLabel: '', href: '' });
                  return;
                }
                onChange({
                  ...block,
                  productId: product.id,
                  title: product.title,
                  imageUrl: productImage(product.images),
                  priceLabel: product.availability === 'available' ? formatPrice(product.price, product.currency) : 'Sold',
                  href: `/shop/${product.id}`,
                });
              }}
              className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900 disabled:bg-gray-50"
            >
              <option value="">{products === null ? 'Loading shop…' : products.length ? 'Choose an artwork' : 'No artworks in the shop yet'}</option>
              {block.productId && !selected && <option value={block.productId}>{block.title || block.productId}</option>}
              {products?.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
            </select>
          </label>
          {block.productId && (
            <div className="flex gap-4">
              {block.imageUrl && <img src={block.imageUrl} alt="" className="h-20 w-20 flex-none rounded border border-gray-200 object-cover" />}
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                <TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} maxLength={200} />
                <TextField label="Price line" value={block.priceLabel} onChange={(priceLabel) => onChange({ ...block, priceLabel })} maxLength={80} placeholder="Optional" />
                <TextField label="Button label" value={block.ctaLabel} onChange={(ctaLabel) => onChange({ ...block, ctaLabel })} maxLength={80} placeholder="View artwork" />
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'divider':
      return <p className="text-sm text-gray-500">A thin line to separate sections.</p>;
  }
}

function BlockList({
  blocks,
  onChange,
  issuesByBlock,
  audienceKind = 'subscriber',
}: {
  blocks: NewsletterBlock[];
  onChange: (blocks: NewsletterBlock[]) => void;
  issuesByBlock: Map<string, NewsletterIssue[]>;
  audienceKind?: AutomationAudienceKind;
}) {
  const needsProducts = blocks.some((block) => block.type === 'product');
  const [products, setProducts] = useState<ProductOption[] | null>(null);

  useEffect(() => {
    if (!needsProducts || products !== null) return;
    let cancelled = false;
    newsletterRequest<{ products: ProductOption[] }>('/api/admin/products')
      .then((data) => { if (!cancelled) setProducts(data.products); })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, [needsProducts, products]);

  const controlClass = 'rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Add a block below to start writing.</p>
      )}
      {blocks.map((block, index) => {
        const issues = issuesByBlock.get(block.id) ?? [];
        return (
          <div key={block.id} id={blockElementId(block.id)} className={`scroll-mt-4 rounded-md border p-4 ${issues.length ? 'border-amber-300' : 'border-gray-200'}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{NEWSLETTER_BLOCK_LABELS[block.type]}</span>
              <div className="flex gap-1">
                <button type="button" className={controlClass} disabled={index === 0} onClick={() => onChange(reorder(blocks, index, -1))} aria-label={`Move ${NEWSLETTER_BLOCK_LABELS[block.type]} block up`}>Up</button>
                <button type="button" className={controlClass} disabled={index === blocks.length - 1} onClick={() => onChange(reorder(blocks, index, 1))} aria-label={`Move ${NEWSLETTER_BLOCK_LABELS[block.type]} block down`}>Down</button>
                <button type="button" className={`${controlClass} hover:text-red-700`} onClick={() => onChange(blocks.filter((entry) => entry.id !== block.id))}>Remove</button>
              </div>
            </div>
            <BlockFields
              block={block}
              products={products}
              audienceKind={audienceKind}
              onChange={(next) => onChange(blocks.map((entry) => (entry.id === block.id ? next : entry)))}
            />
            {issues.map((issue) => <p key={issue.key} className="mt-3 text-xs text-amber-800">{issue.message}</p>)}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-sm text-gray-600">Add</span>
        {BLOCK_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            disabled={blocks.length >= MAX_BLOCKS}
            onClick={() => onChange([...blocks, createNewsletterBlock(type)])}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {type === 'product' ? 'Artwork' : NEWSLETTER_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

function IssueList({ issues, readyText }: { issues: NewsletterIssue[]; readyText: string }) {
  if (issues.length === 0) {
    return <p className="text-sm text-green-700">✓ {readyText}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-amber-900">
      {issues.map((issue) => {
        const setting = SETTING_FOR_ISSUE[issue.key];
        return (
          <li key={issue.key} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              {issue.message}{' '}
              {setting && <Link href={adminSettingFieldHref(setting)} className="font-medium underline">Open Settings</Link>}
              {issue.blockId && (
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => document.getElementById(blockElementId(issue.blockId!))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Show block
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

type EditorProps = {
  /** Null while composing a newsletter that has not been saved yet. */
  newsletter: NewsletterSummary | null;
  context: NewsletterAdminContext;
  onSaved: (newsletter: NewsletterSummary) => void;
  onDeleted: (id: string) => void;
  onStale: () => void;
  onBack: () => void;
};

type BusyAction = 'save' | 'test' | 'send' | 'schedule' | 'delete';

export function NewsletterEditor({ newsletter, context, onSaved, onDeleted, onStale, onBack }: EditorProps) {
  const [draft, setDraft] = useState<NewsletterDocument>(() => newsletter?.document ?? createNewsletterDraft());
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const { busy, notice, setNotice, run } = useNewsletterAction<BusyAction>(
    onStale,
    newsletter?.status === 'paused' && newsletter.metrics.lastError ? { tone: 'error', text: newsletter.metrics.lastError } : null,
  );
  const [testEmails, setTestEmails] = useState(context.testRecipient.email);
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue(newsletter?.scheduledAt ?? null));

  const dirty = JSON.stringify(draft) !== baseline;
  const contentIssues = useMemo(() => newsletterContentIssues(draft, context), [draft, context]);
  const sendIssues = useMemo(() => newsletterSendIssues(draft, context), [draft, context]);
  const issuesByBlock = useMemo(() => {
    const map = new Map<string, NewsletterIssue[]>();
    for (const issue of sendIssues) {
      if (issue.blockId) map.set(issue.blockId, [...(map.get(issue.blockId) ?? []), issue]);
    }
    return map;
  }, [sendIssues]);

  useUnsavedChangesGuard(dirty);

  const update = (patch: Partial<NewsletterDocument>) => setDraft((current) => ({ ...current, ...patch }));
  const scheduled = newsletter?.status === 'scheduled';

  async function persist(): Promise<NewsletterSummary> {
    const { newsletter: saved } = newsletter
      ? await newsletterRequest<{ newsletter: NewsletterSummary }>(`/api/admin/newsletters/${newsletter.id}`, { method: 'PUT', body: { document: draft } })
      : await newsletterRequest<{ newsletter: NewsletterSummary }>('/api/admin/newsletters', { method: 'POST', body: { document: draft } });
    setDraft(saved.document);
    setBaseline(JSON.stringify(saved.document));
    onSaved(saved);
    return saved;
  }

  async function savedNewsletter(): Promise<NewsletterSummary> {
    return newsletter && !dirty ? newsletter : persist();
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    void run('save', async () => {
      await persist();
      setNotice({ tone: 'success', text: scheduled ? 'Saved. The scheduled send will use these changes.' : 'Draft saved.' });
    });
  }

  function handleTest() {
    const emails = testEmails.split(',').map((email) => email.trim()).filter(Boolean);
    void run('test', async () => {
      const result = await newsletterRequest<{ delivered: string[]; failed: string[]; deliveryMode: string }>(
        '/api/admin/newsletters/test',
        { method: 'POST', body: { document: draft, emails } },
      );
      if (result.failed.length) {
        setNotice({ tone: 'error', text: `Couldn’t deliver the test to ${result.failed.join(', ')}. Check Email delivery in Settings.` });
      } else if (result.deliveryMode === 'smtp') {
        setNotice({ tone: 'success', text: `Test sent to ${result.delivered.join(', ')}.` });
      } else if (result.deliveryMode === 'log') {
        setNotice({ tone: 'info', text: 'Email delivery is in log mode, so the test was written to the server log instead of an inbox.' });
      } else {
        setNotice({ tone: 'error', text: 'SMTP setup isn’t finished in Settings, so the test wasn’t sent.' });
      }
    });
  }

  async function copyManualDraft(format: 'text' | 'html') {
    try {
      const rendered = personalizeNewsletter(
        renderNewsletter(draft, context),
        newsletterMergeValues(
          { email: context.testRecipient.email, firstName: '' },
          context,
          context.siteUrl ? `${context.siteUrl.replace(/\/+$/, '')}/subscribe` : '#',
        ),
      );
      const payload = format === 'html'
        ? rendered.html
        : `Subject: ${rendered.subject}\n\n${rendered.text}`;
      await navigator.clipboard.writeText(payload);
      setNotice({
        tone: 'success',
        text: format === 'html' ? 'Newsletter HTML copied to clipboard.' : 'Newsletter subject and text copied to clipboard.',
      });
    } catch {
      setNotice({ tone: 'error', text: 'Could not access clipboard in this browser.' });
    }
  }

  async function copySubscriberEmails() {
    try {
      const data = await newsletterRequest<{ subscribers: Array<{ email: string }> }>('/api/admin/newsletters/subscribers');
      const emails = data.subscribers.map((entry) => entry.email).filter(Boolean);
      if (emails.length === 0) {
        setNotice({ tone: 'info', text: 'No subscribers yet.' });
        return;
      }
      await navigator.clipboard.writeText(emails.join(', '));
      setNotice({ tone: 'success', text: `Copied ${emails.length} subscriber ${emails.length === 1 ? 'email' : 'emails'} for BCC.` });
    } catch {
      setNotice({ tone: 'error', text: 'Could not copy subscriber emails.' });
    }
  }

  function handleSend() {
    const audience = subscriberLabel(context.subscriberCount);
    if (!window.confirm(`Send “${draft.subject.trim()}” to ${audience} now? This can’t be undone.`)) return;
    void run('send', async () => {
      const saved = await savedNewsletter();
      const { newsletter: sending } = await newsletterRequest<{ newsletter: NewsletterSummary }>(
        `/api/admin/newsletters/${saved.id}`,
        { method: 'POST', body: { action: 'send' } },
      );
      onSaved(sending);
    });
  }

  function handleSchedule() {
    void run('schedule', async () => {
      const saved = await savedNewsletter();
      const { newsletter: next } = await newsletterRequest<{ newsletter: NewsletterSummary }>(
        `/api/admin/newsletters/${saved.id}`,
        { method: 'POST', body: { action: 'schedule', scheduledAt: new Date(scheduleAt).toISOString() } },
      );
      onSaved(next);
      setNotice({ tone: 'success', text: `Scheduled for ${formatNewsletterDate(next.scheduledAt!)}.` });
    });
  }

  function handleUnschedule() {
    if (!newsletter) return;
    void run('schedule', async () => {
      const { newsletter: next } = await newsletterRequest<{ newsletter: NewsletterSummary }>(
        `/api/admin/newsletters/${newsletter.id}`,
        { method: 'POST', body: { action: 'unschedule' } },
      );
      onSaved(next);
      setNotice({ tone: 'info', text: 'Unscheduled. It’s a draft again.' });
    });
  }

  function handleDelete() {
    if (!newsletter) {
      onBack();
      return;
    }
    if (!window.confirm('Delete this draft? This can’t be undone.')) return;
    void run('delete', async () => {
      await newsletterRequest(`/api/admin/newsletters/${newsletter.id}`, { method: 'DELETE' });
      onDeleted(newsletter.id);
    });
  }

  function handleBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave this newsletter anyway?')) return;
    onBack();
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sendDisabled = busy !== null || sendIssues.length > 0;

  return (
    <div className="space-y-6" data-testid="newsletter-editor">
      <button type="button" onClick={handleBack} className="text-sm font-medium text-gray-700 hover:text-gray-900">← All newsletters</button>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <form onSubmit={handleSave} className="rounded-lg border bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{draft.subject.trim() || 'Untitled newsletter'}</h2>
            <NewsletterStatusBadge status={newsletter?.status ?? 'draft'} />
          </div>

          <NoticeBanner notice={notice} />

          <EditorSection title="Envelope" defaultOpen>
            <TextField
              label="From name"
              value={draft.fromName}
              onChange={(fromName) => update({ fromName })}
              placeholder={context.siteName}
              maxLength={80}
              help={`Sent from ${context.fromAddress || 'your SMTP address'}${context.replyTo ? ` · replies go to ${context.replyTo}` : ''}.`}
            />
            <div>
              <TextField label="Subject" value={draft.subject} onChange={(subject) => update({ subject })} maxLength={200} />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>{draft.subject.length}/200 · Inboxes show about the first 60 characters.</span>
                <MergeFieldMenu onInsert={(token) => update({ subject: appendToken(draft.subject, token) })} />
              </div>
            </div>
            <div>
              <TextField label="Preview text" value={draft.preheader} onChange={(preheader) => update({ preheader })} maxLength={200} placeholder="Optional" />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>Shown after the subject in most inboxes.</span>
                <MergeFieldMenu onInsert={(token) => update({ preheader: appendToken(draft.preheader, token) })} />
              </div>
            </div>
          </EditorSection>

          <EditorSection title="Content" defaultOpen>
            <BlockList blocks={draft.blocks} onChange={(blocks) => update({ blocks })} issuesByBlock={issuesByBlock} />
          </EditorSection>

          <EditorSection title="Send" defaultOpen>
            <IssueList issues={sendIssues} readyText={`Ready to send to ${subscriberLabel(context.subscriberCount)}.`} />

            <div className="rounded-md bg-gray-50 p-4 space-y-3">
              <TextField
                label="Send a test to"
                value={testEmails}
                onChange={setTestEmails}
                placeholder="you@example.com"
                help="Separate up to 5 addresses with commas. Test subjects start with [Test]."
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={busy !== null || contentIssues.length > 0}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'test' ? 'Sending test…' : 'Send test'}
              </button>
            </div>

            <button type="button" onClick={handleSend} disabled={sendDisabled} className="btn-primary w-full px-5 py-2.5 disabled:opacity-50">
              {busy === 'send' ? 'Starting send…' : `Send now to ${subscriberLabel(context.subscriberCount)}`}
            </button>

            {context.deliveryMode !== 'smtp' && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">Send manually without SMTP</p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Copy this draft and your subscriber list to send from Gmail, Apple Mail, or Substack — or{' '}
                    <Link href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')} className="font-medium text-gray-800 underline hover:text-gray-900">
                      enable SMTP in Settings →
                    </Link>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyManualDraft('text')}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy text
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyManualDraft('html')}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => void copySubscriberEmails()}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy subscriber emails ({context.subscriberCount.toLocaleString()})
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-md bg-gray-50 p-4 space-y-3">
              {scheduled ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-700">Scheduled for <strong>{formatNewsletterDate(newsletter!.scheduledAt!)}</strong>.</p>
                  <button type="button" onClick={handleUnschedule} disabled={busy !== null} className="text-sm font-medium text-gray-700 underline hover:text-gray-900 disabled:opacity-50">Unschedule</button>
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700">
                    Schedule for later (optional)
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      min={toLocalInputValue(new Date().toISOString())}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                    />
                    <span className="mt-1 block text-xs font-normal text-gray-500">
                      Your time zone: {timezone}. Built-in scheduling checks automatically every 30 minutes.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSchedule}
                    disabled={sendDisabled || !scheduleAt}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
                  </button>
                </>
              )}
            </div>
          </EditorSection>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={handleDelete} disabled={busy !== null} className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50">
              {newsletter ? 'Delete draft' : 'Discard'}
            </button>
            <button type="submit" disabled={busy !== null || (!dirty && Boolean(newsletter))} className="btn-primary px-5 py-2 disabled:opacity-50">
              {busy === 'save' ? 'Saving...' : 'Save draft'}
            </button>
          </div>
        </form>

        <NewsletterPreview document={draft} context={context} dirty={dirty} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report (sent or sending)
// ---------------------------------------------------------------------------

type ReportProps = {
  newsletter: NewsletterSummary;
  context: NewsletterAdminContext;
  onSaved: (newsletter: NewsletterSummary) => void;
  onDeleted: (id: string) => void;
  onDuplicate: (document: NewsletterDocument) => Promise<void>;
  onStale: () => void;
  onBack: () => void;
};

export function NewsletterReport({ newsletter, context, onSaved, onDeleted, onDuplicate, onStale, onBack }: ReportProps) {
  const { busy, notice, run } = useNewsletterAction<'send' | 'duplicate' | 'delete'>(onStale);
  const { metrics, status } = newsletter;
  const sending = status === 'active';
  const interrupted = status === 'paused' && !newsletter.sentAt;
  const processed = metrics.delivered + metrics.failed;
  const progress = metrics.total ? Math.min(100, Math.round((processed / metrics.total) * 100)) : 0;

  function handleResend() {
    void run('send', async () => {
      const { newsletter: next } = await newsletterRequest<{ newsletter: NewsletterSummary }>(
        `/api/admin/newsletters/${newsletter.id}`,
        { method: 'POST', body: { action: 'send' } },
      );
      onSaved(next);
    });
  }

  function handleDelete() {
    if (!window.confirm('Delete this newsletter and its delivery report? This can’t be undone.')) return;
    void run('delete', async () => {
      await newsletterRequest(`/api/admin/newsletters/${newsletter.id}`, { method: 'DELETE' });
      onDeleted(newsletter.id);
    });
  }

  const stats = [
    { label: 'Delivered', value: metrics.delivered },
    { label: 'Failed', value: metrics.failed },
    { label: 'Recipients', value: metrics.total },
  ];

  return (
    <div className="space-y-6" data-testid="newsletter-report">
      <button type="button" onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900">← All newsletters</button>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <div className="rounded-lg border bg-white p-6 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{newsletter.document.subject || 'Untitled newsletter'}</h2>
              <NewsletterStatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {sending && 'Sending now. You can leave this page — delivery continues in the background.'}
              {status === 'completed' && newsletter.sentAt && `Sent ${formatNewsletterDate(newsletter.sentAt)}.`}
              {status === 'paused' && (interrupted ? 'Sending stopped before everyone received it.' : `Sent ${formatNewsletterDate(newsletter.sentAt!)}, but the latest retry stopped early.`)}
            </p>
          </div>

          <NoticeBanner notice={notice} />
          {status === 'paused' && metrics.lastError && <NoticeBanner notice={{ tone: 'error', text: metrics.lastError }} />}

          <dl className="grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md border border-gray-200 p-3">
                <dt className="text-xs text-gray-500">{stat.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-gray-900">{stat.value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>

          {sending && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-500">{processed.toLocaleString()} of {metrics.total.toLocaleString()} processed</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!sending && (interrupted || metrics.failed > 0) && (
              <button type="button" onClick={handleResend} disabled={busy !== null} className="btn-primary px-4 py-2 disabled:opacity-50">
                {busy === 'send' ? 'Starting…' : interrupted ? 'Resume sending' : `Retry ${metrics.failed.toLocaleString()} failed`}
              </button>
            )}
            <button
              type="button"
              onClick={() => void run('duplicate', () => onDuplicate(newsletter.document))}
              disabled={busy !== null}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
            </button>
            {!sending && (
              <button type="button" onClick={handleDelete} disabled={busy !== null} className="ml-auto text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
        </div>

        <NewsletterPreview document={newsletter.document} context={context} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation email editor (reuses Envelope, Blocks, Preview, and Test Send)
// ---------------------------------------------------------------------------

type AutomationEditorProps = {
  automation: AutomationEmailSummary;
  context: NewsletterAdminContext;
  onSaved: (automation: AutomationEmailSummary) => void;
  onStale: () => void;
  onBack: () => void;
};

type AutomationBusyAction = 'save' | 'test' | 'reset';

function automationReadinessIssues(
  automation: AutomationEmailSummary,
  enabled: boolean,
  context: NewsletterAdminContext,
  contentIssues: NewsletterIssue[],
): NewsletterIssue[] {
  const issues = [...contentIssues];
  if (!context.siteUrl) {
    issues.push({ key: 'site-url', message: 'Set your public site URL in Settings so links work in email.' });
  }
  if (automation.audienceKind === 'subscriber' && !context.footerAddress.trim()) {
    issues.push({ key: 'address', message: 'Add a mailing address for the email footer in Settings (required by anti-spam law).' });
  }
  if (context.deliveryMode === 'log') {
    issues.push({ key: 'delivery', message: 'Email delivery is in log mode. Switch to SMTP in Settings so automated emails reach inboxes.' });
  } else if (context.deliveryMode === 'unconfigured') {
    issues.push({ key: 'delivery', message: 'Finish SMTP setup in Settings → Email delivery so automated emails can send.' });
  } else if (isResendSandboxSender(context.fromAddress)) {
    issues.push({ key: 'sandbox-sender', message: 'From address uses Resend sandbox (onboarding@resend.dev), which only delivers to your Resend account email.' });
  }
  return issues;
}

export function AutomationEmailEditor({ automation, context, onSaved, onStale, onBack }: AutomationEditorProps) {
  const [draft, setDraft] = useState<NewsletterDocument>(() => automation.document);
  const [enabled, setEnabled] = useState<boolean>(() => automation.enabled);
  const [winbackDays, setWinbackDays] = useState<string>(() => String(automation.winbackDays ?? 45));
  const [promoCode, setPromoCode] = useState<string>(() => automation.cartRecoveryPromoCode ?? '');
  const [baseline, setBaseline] = useState(() => JSON.stringify({
    draft: automation.document,
    enabled: automation.enabled,
    winbackDays: String(automation.winbackDays ?? 45),
    promoCode: automation.cartRecoveryPromoCode ?? '',
  }));
  const [testEmails, setTestEmails] = useState(context.testRecipient.email);
  const { busy, notice, setNotice, run } = useNewsletterAction<AutomationBusyAction>(onStale);

  const currentSnapshot = useMemo(() => JSON.stringify({ draft, enabled, winbackDays, promoCode }), [draft, enabled, winbackDays, promoCode]);
  const dirty = currentSnapshot !== baseline;
  const contentIssues = useMemo(
    () => newsletterContentIssues(draft, context, { audienceKind: automation.audienceKind }),
    [draft, context, automation.audienceKind],
  );
  const readinessIssues = useMemo(
    () => automationReadinessIssues(automation, enabled, context, contentIssues),
    [automation, enabled, context, contentIssues],
  );
  const issuesByBlock = useMemo(() => {
    const map = new Map<string, NewsletterIssue[]>();
    for (const issue of contentIssues) {
      if (issue.blockId) map.set(issue.blockId, [...(map.get(issue.blockId) ?? []), issue]);
    }
    return map;
  }, [contentIssues]);

  useUnsavedChangesGuard(dirty);

  const update = (patch: Partial<NewsletterDocument>) => setDraft((current) => ({ ...current, ...patch }));

  const isWinback = automation.id === AUTOMATION_EMAIL_IDS.collectorWinback;
  const isCartRecovery = automation.id === AUTOMATION_EMAIL_IDS.cartRecovery;
  const [availablePromos, setAvailablePromos] = useState<Array<{ id: string; code: string; discountType: string; discountValue: number }>>([]);
  const documentChangedFromDefault = JSON.stringify(draft) !== JSON.stringify(automation.defaultDocument);

  useEffect(() => {
    if (!isCartRecovery) return;
    let cancelled = false;
    newsletterRequest<{ promoCodes?: Array<{ id: string; code: string; discountType: string; discountValue: number }> }>('/api/admin/promo-codes')
      .then((data) => {
        if (!cancelled && Array.isArray(data.promoCodes)) setAvailablePromos(data.promoCodes);
      })
      .catch(() => {
        // Optional quick-pick helper; manual entry still works.
      });
    return () => { cancelled = true; };
  }, [isCartRecovery]);

  function syncSavedState(saved: AutomationEmailSummary) {
    const nextWinback = String(saved.winbackDays ?? 45);
    const nextPromo = saved.cartRecoveryPromoCode ?? '';
    setDraft(saved.document);
    setEnabled(saved.enabled);
    setWinbackDays(nextWinback);
    setPromoCode(nextPromo);
    setBaseline(JSON.stringify({
      draft: saved.document,
      enabled: saved.enabled,
      winbackDays: nextWinback,
      promoCode: nextPromo,
    }));
    onSaved(saved);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    void run('save', async () => {
      const parsedDays = Number.parseInt(winbackDays.trim(), 10);
      const body: Record<string, unknown> = {
        enabled,
        ...(automation.customized || documentChangedFromDefault ? { document: draft } : {}),
        ...(isWinback && Number.isFinite(parsedDays) ? { winbackDays: Math.max(14, Math.min(365, parsedDays)) } : {}),
        ...(isCartRecovery ? { cartRecoveryPromoCode: promoCode.trim() } : {}),
      };
      const { automation: saved } = await newsletterRequest<{ automation: AutomationEmailSummary }>(
        `/api/admin/newsletters/${automation.id}`,
        { method: 'PUT', body },
      );
      syncSavedState(saved);
      setNotice({ tone: 'success', text: 'Automation email saved.' });
    });
  }

  function handleReset() {
    if (!window.confirm('Restore the default wording and layout for this automation email? Your custom edits will be replaced.')) return;
    void run('reset', async () => {
      const { automation: saved } = await newsletterRequest<{ automation: AutomationEmailSummary }>(
        `/api/admin/newsletters/${automation.id}`,
        { method: 'PUT', body: { resetToDefault: true } },
      );
      syncSavedState(saved);
      setNotice({ tone: 'info', text: 'Restored to the default studio template.' });
    });
  }

  function handleTest() {
    const emails = testEmails.split(',').map((email) => email.trim()).filter(Boolean);
    void run('test', async () => {
      const result = await newsletterRequest<{ delivered: string[]; failed: string[]; deliveryMode: string }>(
        '/api/admin/newsletters/test',
        {
          method: 'POST',
          body: {
            document: draft,
            emails,
            automationId: automation.id,
            ...(isCartRecovery ? { promoCode: promoCode.trim() } : {}),
          },
        },
      );
      if (result.failed.length) {
        setNotice({ tone: 'error', text: `Couldn’t deliver the test to ${result.failed.join(', ')}. Check Email delivery in Settings.` });
      } else if (result.deliveryMode === 'smtp') {
        setNotice({ tone: 'success', text: `Test sent to ${result.delivered.join(', ')}.` });
      } else if (result.deliveryMode === 'log') {
        setNotice({ tone: 'info', text: 'Email delivery is in log mode, so the test was written to the server log instead of an inbox.' });
      } else {
        setNotice({ tone: 'error', text: 'SMTP setup isn’t finished in Settings, so the test wasn’t sent.' });
      }
    });
  }

  function handleBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave this automation email anyway?')) return;
    onBack();
  }

  const readyText = enabled
    ? `Active · sends automatically (${automation.triggerSummary.toLowerCase()}).`
    : 'Template looks good. Turn this automation on above when you want it to send automatically.';

  return (
    <div className="space-y-6" data-testid="automation-email-editor">
      <button type="button" onClick={handleBack} className="text-sm font-medium text-gray-700 hover:text-gray-900">
        ← All automations
      </button>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <form onSubmit={handleSave} className="rounded-lg border bg-white p-6 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{automation.title}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${enabled ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                {enabled ? 'On' : 'Off'}
              </span>
              {automation.customized && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">Custom</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600">{automation.description}</p>
            {(automation.metrics.delivered > 0 || automation.metrics.failed > 0) && (
              <p className="mt-1.5 text-xs text-gray-500">
                {automation.metrics.delivered.toLocaleString()} delivered
                {automation.metrics.failed ? ` · ${automation.metrics.failed.toLocaleString()} failed` : ''}
                {automation.metrics.lastSentAt ? ` · Last sent ${formatNewsletterDate(automation.metrics.lastSentAt)}` : ''}
              </p>
            )}
          </div>

          <NoticeBanner notice={notice} />

          <EditorSection title="Automation" defaultOpen>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Automatic sending</p>
                <p className="text-xs text-gray-500">Trigger: {automation.triggerSummary}</p>
              </div>
              <div className="flex rounded-md border border-gray-300 bg-white text-xs font-medium" role="group" aria-label="Automation status">
                <button
                  type="button"
                  onClick={() => setEnabled(true)}
                  aria-pressed={enabled}
                  className={`px-3 py-1.5 rounded-l-md ${enabled ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setEnabled(false)}
                  aria-pressed={!enabled}
                  className={`px-3 py-1.5 rounded-r-md ${!enabled ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Off
                </button>
              </div>
            </div>

            {isWinback && (
              <label className="block text-sm font-medium text-gray-700">
                Quiet period before sending (days)
                <input
                  type="number"
                  min={14}
                  max={365}
                  value={winbackDays}
                  onChange={(event) => setWinbackDays(event.target.value)}
                  className="mt-1 block h-10 w-36 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Minimum days since last visit, order, or signup (14–365).
                </span>
              </label>
            )}

            {isCartRecovery && (
              <div className="space-y-2">
                <TextField
                  label="Promo code (optional)"
                  value={promoCode}
                  onChange={setPromoCode}
                  maxLength={64}
                  placeholder="e.g. WELCOME10"
                  help="Optional active promo code from Grow → Marketing → Promo codes. Use {{promo_code}} anywhere in this email to insert it."
                />
                {availablePromos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500">Quick pick:</span>
                    {availablePromos.map((promo) => {
                      const active = promoCode.trim().toUpperCase() === promo.code.toUpperCase();
                      return (
                        <button
                          key={promo.id}
                          type="button"
                          onClick={() => setPromoCode(active ? '' : promo.code)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            active
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {promo.code} ({promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue}`})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <IssueList issues={readinessIssues} readyText={readyText} />
          </EditorSection>

          <EditorSection title="Envelope" defaultOpen>
            <TextField
              label="From name"
              value={draft.fromName}
              onChange={(fromName) => update({ fromName })}
              placeholder={context.siteName}
              maxLength={80}
              help={`Sent from ${context.fromAddress || 'your SMTP address'}${context.replyTo ? ` · replies go to ${context.replyTo}` : ''}.`}
            />
            <div>
              <TextField label="Subject" value={draft.subject} onChange={(subject) => update({ subject })} maxLength={200} />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>{draft.subject.length}/200 · Inboxes show about the first 60 characters.</span>
                <MergeFieldMenu
                  audienceKind={automation.audienceKind}
                  onInsert={(token) => update({ subject: appendToken(draft.subject, token) })}
                />
              </div>
            </div>
            <div>
              <TextField label="Preview text" value={draft.preheader} onChange={(preheader) => update({ preheader })} maxLength={200} placeholder="Optional" />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>Shown after the subject in most inboxes.</span>
                <MergeFieldMenu
                  audienceKind={automation.audienceKind}
                  onInsert={(token) => update({ preheader: appendToken(draft.preheader, token) })}
                />
              </div>
            </div>
          </EditorSection>

          <EditorSection title="Content" defaultOpen>
            <BlockList
              blocks={draft.blocks}
              onChange={(blocks) => update({ blocks })}
              issuesByBlock={issuesByBlock}
              audienceKind={automation.audienceKind}
            />
          </EditorSection>

          <EditorSection title="Test email" defaultOpen>
            <div className="rounded-md bg-gray-50 p-4 space-y-3">
              <TextField
                label="Send a test to"
                value={testEmails}
                onChange={setTestEmails}
                placeholder="you@example.com"
                help="Separate up to 5 addresses with commas. Test subjects start with [Test]."
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={busy !== null || contentIssues.length > 0}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'test' ? 'Sending test…' : 'Send test'}
              </button>
            </div>
          </EditorSection>

          <div className="flex items-center justify-between gap-3">
            <div>
              {(automation.customized || documentChangedFromDefault) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy !== null}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
                >
                  {busy === 'reset' ? 'Restoring…' : 'Reset to default'}
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={busy !== null || !dirty || contentIssues.length > 0}
              className="btn-primary px-5 py-2 disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        <NewsletterPreview
          document={draft}
          context={context}
          dirty={dirty}
          audienceKind={automation.audienceKind}
          promoCode={promoCode}
        />
      </div>
    </div>
  );
}
