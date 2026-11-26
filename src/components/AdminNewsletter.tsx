'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminSettingFieldHref } from '@/components/AdminSettings';
import { isResendSandboxSender } from '@/lib/email-shell';
import NewsletterSubscribers from '@/components/admin/NewsletterSubscribers';
import {
  AutomationEmailEditor,
  NewsletterEditor,
  NewsletterReport,
  NewsletterStatusBadge,
  formatNewsletterDate,
  newsletterRequest,
} from '@/components/admin/NewsletterEditor';
import {
  type AutomationEmailSummary,
  type NewsletterAdminContext,
  type NewsletterDocument,
  type NewsletterSummary,
} from '@/lib/newsletter';

type AutomationMeta = {
  lastRunAt: string | null;
  accountWelcomeEnabled: boolean;
};

type Workspace = {
  newsletters: NewsletterSummary[];
  automations: AutomationEmailSummary[];
  context: NewsletterAdminContext;
  automationMeta?: AutomationMeta;
};

type NewsletterView = 'newsletters' | 'subscribers';

type AdminNewsletterProps = {
  /** 'newsletters' manages broadcasts & subscribers; 'automations' manages all automated studio emails. */
  mode?: 'newsletters' | 'automations';
  onSelectTab?: (tab: string) => void;
};

const NEW_PARAM = 'new';
const POLL_MS = 3000;

function resolveNewsletterView(raw: string | null): NewsletterView {
  return raw === 'subscribers' ? 'subscribers' : 'newsletters';
}

function automationSummaryLine(automation: AutomationEmailSummary): string {
  const parts = [
    automation.triggerSummary,
    automation.metrics.delivered > 0 ? `${automation.metrics.delivered.toLocaleString()} sent` : '',
    automation.document.subject ? `Subject: ${automation.document.subject}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function summaryLine(newsletter: NewsletterSummary): string {
  const { metrics } = newsletter;
  switch (newsletter.status) {
    case 'scheduled':
      return `Sends ${formatNewsletterDate(newsletter.scheduledAt!)}`;
    case 'active':
      return `Sending · ${(metrics.delivered + metrics.failed).toLocaleString()} of ${metrics.total.toLocaleString()}`;
    case 'completed':
      return [
        `Sent ${formatNewsletterDate(newsletter.sentAt!)}`,
        `${metrics.delivered.toLocaleString()} delivered`,
        metrics.failed ? `${metrics.failed.toLocaleString()} failed` : '',
      ].filter(Boolean).join(' · ');
    case 'paused':
      return metrics.lastError || 'Sending stopped';
    default:
      return `Edited ${formatNewsletterDate(newsletter.updatedAt)}`;
  }
}

function DeliveryBanner({ context }: { context: NewsletterAdminContext }) {
  if (context.deliveryMode === 'smtp') {
    if (!isResendSandboxSender(context.fromAddress)) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Your From email is still <strong>{context.fromAddress}</strong> (Resend sandbox), which only delivers to your own Resend account email. Verify your domain in Resend and{' '}
        <Link href={adminSettingFieldHref('SMTP_FROM')} className="font-medium underline">update your From email</Link>{' '}
        before sending to collectors.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {context.deliveryMode === 'log'
        ? 'Email delivery is off. You can still draft newsletters, customize templates, copy drafts for Gmail/Apple Mail, and export subscribers. '
        : 'SMTP is selected but not finished yet. You can copy drafts to send externally or finish SMTP setup. '}
      <Link href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')} className="font-medium underline">Set up SMTP in Settings</Link>
    </div>
  );
}

export default function AdminNewsletter({ mode = 'newsletters', onSelectTab }: AdminNewsletterProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get('newsletter');
  const selectedAutomation = searchParams.get('automation');
  const viewParam = searchParams.get('view');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<NewsletterView>(() => resolveNewsletterView(viewParam));
  const [editorKey, setEditorKey] = useState(selected ?? '');
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [savingAccountWelcome, setSavingAccountWelcome] = useState(false);
  const [automationNotice, setAutomationNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const createdIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWorkspace(await newsletterRequest<Workspace>('/api/admin/newsletters'));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load email workspace.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === 'newsletters') {
      setView(resolveNewsletterView(viewParam));
    }
  }, [mode, viewParam]);

  const sending = workspace?.newsletters.some((newsletter) => newsletter.status === 'active') ?? false;
  useEffect(() => {
    if (!sending) return undefined;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [sending, load]);

  useEffect(() => {
    if (selected && selected === createdIdRef.current) return;
    createdIdRef.current = null;
    setEditorKey(selected ?? '');
  }, [selected]);

  const navigateParams = useCallback((targetTab: 'newsletter' | 'automations', mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', targetTab);
    mutate(params);
    const nextUrl = `/admin?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextUrl);
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }, [router, searchParams]);

  const open = useCallback((id: string | null) => {
    setView('newsletters');
    navigateParams('newsletter', (params) => {
      params.delete('automation');
      params.delete('view');
      if (id) {
        params.set('newsletter', id);
      } else {
        params.delete('newsletter');
      }
    });
  }, [navigateParams]);

  const openAutomation = useCallback((id: string | null) => {
    navigateParams('automations', (params) => {
      params.delete('newsletter');
      params.delete('view');
      if (id) {
        params.set('automation', id);
      } else {
        params.delete('automation');
      }
    });
  }, [navigateParams]);

  const selectView = useCallback((nextView: NewsletterView) => {
    setView(nextView);
    navigateParams('newsletter', (params) => {
      params.delete('newsletter');
      params.delete('automation');
      if (nextView === 'newsletters') params.delete('view');
      else params.set('view', nextView);
    });
  }, [navigateParams]);

  const handleSaved = useCallback((saved: NewsletterSummary) => {
    setWorkspace((current) => current && {
      ...current,
      newsletters: [saved, ...current.newsletters.filter((entry) => entry.id !== saved.id)],
    });
    if (selected === NEW_PARAM) {
      createdIdRef.current = saved.id;
      open(saved.id);
    }
  }, [open, selected]);

  const handleAutomationSaved = useCallback((saved: AutomationEmailSummary) => {
    setWorkspace((current) => current && {
      ...current,
      automations: current.automations.map((entry) => (entry.id === saved.id ? saved : entry)),
    });
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setWorkspace((current) => current && { ...current, newsletters: current.newsletters.filter((entry) => entry.id !== id) });
    open(null);
  }, [open]);

  const handleDuplicate = useCallback(async (document: NewsletterDocument) => {
    const subject = !document.subject || document.subject.endsWith(' (copy)')
      ? document.subject
      : `${document.subject} (copy)`.slice(0, 200);
    const { newsletter } = await newsletterRequest<{ newsletter: NewsletterSummary }>('/api/admin/newsletters', {
      method: 'POST',
      body: { document: { ...document, subject } },
    });
    setWorkspace((current) => current && { ...current, newsletters: [newsletter, ...current.newsletters] });
    open(newsletter.id);
  }, [open]);

  const handleRunAutomationsNow = useCallback(async () => {
    setRunningAutomation(true);
    setAutomationNotice(null);
    try {
      const response = await fetch('/api/admin/automation/run', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Automation run failed.');
      const processed = Number(data.processed ?? 0);
      setAutomationNotice({
        tone: 'success',
        text: processed > 0
          ? `Automations completed. Processed ${processed} ${processed === 1 ? 'job' : 'jobs'}.`
          : 'Automations ran. No pending emails were due right now.',
      });
      await load();
    } catch (error) {
      setAutomationNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Automation run failed.',
      });
    } finally {
      setRunningAutomation(false);
    }
  }, [load]);

  const handleToggleAccountWelcome = useCallback(async (nextEnabled: boolean) => {
    setSavingAccountWelcome(true);
    setAutomationNotice(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { WELCOME_EMAIL_ENABLED: String(nextEnabled) } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update account signup welcome setting.');
      setWorkspace((current) => current && {
        ...current,
        automationMeta: {
          lastRunAt: current.automationMeta?.lastRunAt ?? null,
          accountWelcomeEnabled: nextEnabled,
        },
      });
      setAutomationNotice({
        tone: 'success',
        text: nextEnabled
          ? 'Account signup welcome emails turned on.'
          : 'Account signup welcome emails turned off.',
      });
    } catch (error) {
      setAutomationNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not update account signup welcome setting.',
      });
    } finally {
      setSavingAccountWelcome(false);
    }
  }, []);

  if (!workspace) {
    return (
      <div className={`rounded-lg border p-6 ${loadError ? 'border-red-200 bg-red-50 text-red-800' : 'bg-white text-gray-600'}`}>
        <p>{loadError || (mode === 'automations' ? 'Loading automations...' : 'Loading newsletters...')}</p>
        {loadError && (
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-medium underline">Retry</button>
        )}
      </div>
    );
  }

  const { context, newsletters, automations = [], automationMeta } = workspace;

  if (selectedAutomation) {
    const automation = automations.find((entry) => entry.id === selectedAutomation);
    if (!automation) {
      return (
        <div className="rounded-lg border bg-white p-6 text-gray-700">
          <p>This automation email could not be found.</p>
          <button type="button" onClick={() => openAutomation(null)} className="mt-3 text-sm font-medium underline">Back to automations</button>
        </div>
      );
    }
    return (
      <AutomationEmailEditor
        key={automation.id}
        automation={automation}
        context={context}
        onSaved={handleAutomationSaved}
        onStale={() => void load()}
        onBack={() => openAutomation(null)}
      />
    );
  }

  if (mode === 'automations') {
    const activeCount = automations.filter((entry) => entry.enabled).length;
    const accountWelcomeEnabled = Boolean(automationMeta?.accountWelcomeEnabled);
    const lastRunLabel = automationMeta?.lastRunAt
      ? new Date(automationMeta.lastRunAt).toLocaleString()
      : 'Not recorded yet';

    return (
      <div className="space-y-6" data-testid="automations-admin">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Automations</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Automated emails sent on signup, quiet periods, and abandoned checkouts. {activeCount} of {automations.length} studio templates active.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 self-start sm:self-auto">
            <span className="text-xs text-gray-500">Last run: {lastRunLabel}</span>
            <button
              type="button"
              onClick={() => void handleRunAutomationsNow()}
              disabled={runningAutomation}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {runningAutomation ? 'Running…' : 'Run automations now'}
            </button>
          </div>
        </div>

        <DeliveryBanner context={context} />

        {automationNotice && (
          <div
            role={automationNotice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border p-3.5 text-sm ${
              automationNotice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {automationNotice.text}
          </div>
        )}

        <div className="space-y-4" data-testid="automation-emails-list">
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {automations.map((automation) => (
              <li key={automation.id}>
                <button
                  type="button"
                  onClick={() => openAutomation(automation.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{automation.title}</span>
                      {automation.customized && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">Custom</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-gray-500">
                      {automationSummaryLine(automation)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${automation.enabled ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {automation.enabled ? 'On' : 'Off'}
                    </span>
                    <span className="text-xs font-medium text-gray-500">Edit →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Collector account registration welcome (site-wide toggle, no longer buried in Settings → Email Delivery) */}
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">Collector account signup welcome</p>
              <p className="mt-0.5 text-sm text-gray-600">
                Send a welcome email when someone registers a storefront collector account (separate from newsletter signups).
              </p>
            </div>
            <div className="flex shrink-0 rounded-md border border-gray-300 bg-white text-xs font-medium self-start sm:self-auto" role="group" aria-label="Collector account signup welcome">
              <button
                type="button"
                disabled={savingAccountWelcome}
                aria-pressed={accountWelcomeEnabled}
                onClick={() => {
                  if (!accountWelcomeEnabled) void handleToggleAccountWelcome(true);
                }}
                className={`rounded-l-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  accountWelcomeEnabled ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                On
              </button>
              <button
                type="button"
                disabled={savingAccountWelcome}
                aria-pressed={!accountWelcomeEnabled}
                onClick={() => {
                  if (accountWelcomeEnabled) void handleToggleAccountWelcome(false);
                }}
                className={`rounded-r-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  !accountWelcomeEnabled ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Off
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">Post-market follow-up</p>
                <p className="mt-0.5 text-sm text-gray-600">
                  Thank-you emails for booth buyers and guestbook signups are configured per market event, not as a site-wide template.
                </p>
              </div>
              {onSelectTab ? (
                <button
                  type="button"
                  onClick={() => onSelectTab('markets')}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Open Markets →
                </button>
              ) : (
                <Link
                  href="/admin?tab=markets"
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Open Markets →
                </Link>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Scheduled newsletters and automations run automatically while your site is online using your{' '}
            <Link href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')} className="font-medium text-gray-700 underline hover:text-gray-900">
              Email Delivery settings
            </Link>
            . Need an external cron webhook? Configure it under{' '}
            <Link href={adminSettingFieldHref('CRON_SECRET')} className="font-medium text-gray-700 underline hover:text-gray-900">
              Settings → Integrations
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (selected) {
    const newsletter = selected === NEW_PARAM ? null : newsletters.find((entry) => entry.id === selected);
    if (newsletter === undefined) {
      return (
        <div className="rounded-lg border bg-white p-6 text-gray-700">
          <p>This newsletter no longer exists.</p>
          <button type="button" onClick={() => open(null)} className="mt-3 text-sm font-medium underline">Back to newsletters</button>
        </div>
      );
    }
    if (newsletter && !newsletter.editable) {
      return (
        <NewsletterReport
          newsletter={newsletter}
          context={context}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDuplicate={handleDuplicate}
          onStale={() => void load()}
          onBack={() => open(null)}
        />
      );
    }
    return (
      <NewsletterEditor
        key={editorKey}
        newsletter={newsletter}
        context={context}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onStale={() => void load()}
        onBack={() => open(null)}
      />
    );
  }

  const pillClass = (active: boolean) => `rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;

  return (
    <div className="space-y-6" data-testid="newsletter-admin">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Newsletter</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Write studio broadcasts and manage your subscriber list. Automated welcome and follow-up emails live in{' '}
            {onSelectTab ? (
              <button
                type="button"
                onClick={() => onSelectTab('automations')}
                className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
              >
                Automations
              </button>
            ) : (
              <Link href="/admin?tab=automations" className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700">
                Automations
              </Link>
            )}
            .
          </p>
        </div>
        <button type="button" onClick={() => open(NEW_PARAM)} className="btn-primary shrink-0 self-start whitespace-nowrap px-5 py-2 sm:self-auto">
          New newsletter
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Newsletter views">
        <button type="button" role="tab" aria-selected={view === 'newsletters'} onClick={() => selectView('newsletters')} className={pillClass(view === 'newsletters')}>
          Newsletters <span className="ml-1 opacity-70">{newsletters.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={view === 'subscribers'} onClick={() => selectView('subscribers')} className={pillClass(view === 'subscribers')}>
          Subscribers <span className="ml-1 opacity-70">{context.subscriberCount.toLocaleString()}</span>
        </button>
      </div>

      <DeliveryBanner context={context} />

      {!context.footerAddress.trim() && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          <span>Add a postal mailing address (a PO box works) before sending newsletters to comply with anti-spam law.</span>
          <Link href={adminSettingFieldHref('NEWSLETTER_FOOTER_ADDRESS')} className="shrink-0 font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700">
            Add footer address →
          </Link>
        </div>
      )}

      {view === 'subscribers' ? (
        <NewsletterSubscribers onChange={() => void load()} />
      ) : newsletters.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <h3 className="text-base font-semibold text-gray-900">No newsletters yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Share new work, shows, and studio news with {context.subscriberCount ? `your ${context.subscriberCount.toLocaleString()} subscriber${context.subscriberCount === 1 ? '' : 's'}` : 'subscribers as they sign up'}.
          </p>
          <button type="button" onClick={() => open(NEW_PARAM)} className="btn-primary mt-4 px-5 py-2">Write your first newsletter</button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {newsletters.map((newsletter) => (
            <li key={newsletter.id}>
              <button type="button" onClick={() => open(newsletter.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{newsletter.document.subject || 'Untitled newsletter'}</span>
                  <span className={`mt-0.5 block truncate text-sm ${newsletter.status === 'paused' ? 'text-red-700' : 'text-gray-500'}`}>{summaryLine(newsletter)}</span>
                </span>
                <NewsletterStatusBadge status={newsletter.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
