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

type Workspace = {
  newsletters: NewsletterSummary[];
  automations: AutomationEmailSummary[];
  context: NewsletterAdminContext;
};

type NewsletterView = 'newsletters' | 'automations' | 'subscribers';

const NEW_PARAM = 'new';
const POLL_MS = 3000;

function resolveViewParam(raw: string | null): NewsletterView {
  if (raw === 'automations' || raw === 'subscribers') return raw;
  return 'newsletters';
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
        ? 'Email delivery is off — you can still draft newsletters, copy them for Gmail/Apple Mail, and export subscriber emails. '
        : 'SMTP is selected but not finished yet — you can copy drafts to send externally or finish SMTP setup. '}
      <Link href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')} className="font-medium underline">Set up SMTP for one-click sending</Link>
    </div>
  );
}

export default function AdminNewsletter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get('newsletter');
  const selectedAutomation = searchParams.get('automation');
  const viewParam = searchParams.get('view');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<NewsletterView>(() => resolveViewParam(viewParam));
  const [editorKey, setEditorKey] = useState(selected ?? '');
  const createdIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWorkspace(await newsletterRequest<Workspace>('/api/admin/newsletters'));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load newsletters.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (viewParam) {
      setView(resolveViewParam(viewParam));
    }
  }, [viewParam]);

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

  const navigateParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'newsletter');
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
    navigateParams((params) => {
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
    navigateParams((params) => {
      params.delete('newsletter');
      if (id) {
        params.set('automation', id);
        params.set('view', 'automations');
      } else {
        params.delete('automation');
        params.set('view', 'automations');
      }
    });
  }, [navigateParams]);

  const selectView = useCallback((nextView: NewsletterView) => {
    setView(nextView);
    navigateParams((params) => {
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

  if (!workspace) {
    return (
      <div className={`rounded-lg border p-6 ${loadError ? 'border-red-200 bg-red-50 text-red-800' : 'bg-white text-gray-600'}`}>
        <p>{loadError || 'Loading newsletters...'}</p>
        {loadError && (
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-medium underline">Retry</button>
        )}
      </div>
    );
  }

  const { context, newsletters, automations = [] } = workspace;

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

  const pillClass = (active: boolean) => `rounded-md px-4 py-2 text-sm font-medium ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
  const activeAutomationCount = automations.filter((entry) => entry.enabled).length;

  return (
    <div className="space-y-6" data-testid="newsletter-admin">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Newsletter &amp; Email</h2>
          <p className="mt-1 text-sm text-gray-600">Send studio newsletters, customize automated emails, and manage your subscriber list.</p>
        </div>
        <button type="button" onClick={() => open(NEW_PARAM)} className="btn-primary shrink-0 self-start whitespace-nowrap px-5 py-2 sm:self-auto">
          New newsletter
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => selectView('newsletters')} className={pillClass(view === 'newsletters')}>Newsletters</button>
        <button type="button" onClick={() => selectView('automations')} className={pillClass(view === 'automations')}>
          Automations <span className="ml-1 opacity-70">{activeAutomationCount}/{automations.length}</span>
        </button>
        <button type="button" onClick={() => selectView('subscribers')} className={pillClass(view === 'subscribers')}>
          Subscribers <span className="ml-1 opacity-70">{context.subscriberCount.toLocaleString()}</span>
        </button>
      </div>

      <DeliveryBanner context={context} />

      {view === 'subscribers' ? (
        <NewsletterSubscribers onChange={() => void load()} />
      ) : view === 'automations' ? (
        <div className="space-y-4" data-testid="automation-emails-list">
          <ul className="divide-y rounded-lg border bg-white">
            {automations.map((automation) => (
              <li key={automation.id}>
                <button
                  type="button"
                  onClick={() => openAutomation(automation.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
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
        </div>
      ) : newsletters.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          <h3 className="text-base font-semibold text-gray-900">No newsletters yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Share new work, shows, and studio news with {context.subscriberCount ? `your ${context.subscriberCount.toLocaleString()} subscriber${context.subscriberCount === 1 ? '' : 's'}` : 'subscribers as they sign up'}.
          </p>
          <button type="button" onClick={() => open(NEW_PARAM)} className="btn-primary mt-4 px-5 py-2">Write your first newsletter</button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
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
