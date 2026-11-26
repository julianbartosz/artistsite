'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  Plus,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react';
import {
  computeDepositAndBalance,
  computeJobPricing,
  computeQuotedDueDate,
  formatCents,
  JOB_PIPELINE_STEPS,
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  jobStatusTone,
  LICENSE_DEFINITIONS,
  LICENSE_OPTIONS,
  type CommissionAvailabilityStatus,
  type JobCategory,
  type JobStatus,
  type JobTemplate,
  type LicenseType,
  type StudioJobRecord,
} from '@/lib/jobs-shared';

interface CommissionSettings {
  status: CommissionAvailabilityStatus;
  note: string;
  defaultLicense: LicenseType;
  blackoutStart: string;
  blackoutEnd: string;
}

interface AdminJobsProps {
  initialJobId?: string | null;
  onJobIdConsumed?: () => void;
}

type JobFormState = {
  title: string;
  category: JobCategory;
  status: JobStatus;
  clientName: string;
  clientEmail: string;
  scope: string;
  medium: string;
  dimensions: string;
  totalDollars: string;
  depositPercent: number;
  turnaroundDays: number;
  dueDate: string;
  licenseType: LicenseType;
  revisionCap: number;
  killFeePercent: number;
  notes: string;
};

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function emptyForm(defaultLicense: LicenseType = 'personal', blackoutStart?: string, blackoutEnd?: string): JobFormState {
  const due = computeQuotedDueDate(new Date(), 21, blackoutStart, blackoutEnd);
  return {
    title: '',
    category: 'portrait',
    status: 'inquiry',
    clientName: '',
    clientEmail: '',
    scope: '',
    medium: '',
    dimensions: '',
    totalDollars: '500',
    depositPercent: 50,
    turnaroundDays: 21,
    dueDate: due.toISOString().slice(0, 10),
    licenseType: defaultLicense,
    revisionCap: 2,
    killFeePercent: 25,
    notes: '',
  };
}

function jobToForm(job: StudioJobRecord): JobFormState {
  return {
    title: job.title,
    category: job.category,
    status: job.status,
    clientName: job.clientName,
    clientEmail: job.clientEmail,
    scope: job.scope,
    medium: job.medium || '',
    dimensions: job.dimensions || '',
    totalDollars: (job.totalCents / 100).toFixed(2).replace(/\.00$/, ''),
    depositPercent: job.depositPercent,
    turnaroundDays: job.turnaroundDays,
    dueDate: toDateInput(job.dueDate),
    licenseType: job.licenseType,
    revisionCap: job.revisionCap,
    killFeePercent: job.killFeePercent,
    notes: job.notes || '',
  };
}

export default function AdminJobs({ initialJobId, onJobIdConsumed }: AdminJobsProps) {
  const [jobs, setJobs] = useState<StudioJobRecord[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    status: 'open',
    note: '',
    defaultLicense: 'personal',
    blackoutStart: '',
    blackoutEnd: '',
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialJobId ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<JobFormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pricing Helper (Studio-only)
  const [pricingOpen, setPricingOpen] = useState(false);
  const [calcHours, setCalcHours] = useState('8');
  const [calcRate, setCalcRate] = useState('75');
  const [calcMaterials, setCalcMaterials] = useState('60');
  const [calcRush, setCalcRush] = useState('0');

  // WIP Progress Update composer
  const [progressMessage, setProgressMessage] = useState('');
  const [progressImageUrl, setProgressImageUrl] = useState('');
  const [progressNextStatus, setProgressNextStatus] = useState<'' | JobStatus>('');
  const [progressNotify, setProgressNotify] = useState(true);

  // Templates editor modal
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesDraft, setTemplatesDraft] = useState<JobTemplate[]>([]);

  const loadJobs = useCallback(async (selectIdAfter?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
      const loadedJobs: StudioJobRecord[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(loadedJobs);
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      if (data.commissionSettings) {
        setCommissionSettings(data.commissionSettings);
      }
      const targetId = selectIdAfter ?? selectedId;
      if (targetId && loadedJobs.some((j) => j.id === targetId)) {
        setSelectedId(targetId);
      } else if (!creating && loadedJobs.length > 0 && !targetId) {
        setSelectedId(loadedJobs[0].id);
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to load studio jobs',
      });
    } finally {
      setLoading(false);
    }
  }, [creating, selectedId]);

  useEffect(() => {
    void loadJobs(initialJobId ?? null);
    if (initialJobId) {
      setSelectedId(initialJobId);
      setCreating(false);
      onJobIdConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  const selectedJob = useMemo(
    () => (creating ? null : jobs.find((j) => j.id === selectedId) ?? null),
    [creating, jobs, selectedId],
  );

  useEffect(() => {
    if (selectedJob) {
      setForm(jobToForm(selectedJob));
    }
  }, [selectedJob]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (!q) return true;
      return (
        job.title.toLowerCase().includes(q) ||
        job.clientName.toLowerCase().includes(q) ||
        job.clientEmail.toLowerCase().includes(q) ||
        job.jobNumber.toLowerCase().includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const job of jobs) {
      counts[job.status] = (counts[job.status] || 0) + 1;
    }
    return counts;
  }, [jobs]);

  const totalCentsPreview = Math.max(0, Math.round((Number(form.totalDollars) || 0) * 100));
  const { depositCents, balanceCents } = useMemo(
    () => computeDepositAndBalance(totalCentsPreview, form.depositPercent),
    [totalCentsPreview, form.depositPercent],
  );

  const pricingCalc = useMemo(
    () =>
      computeJobPricing({
        hours: Number(calcHours) || 0,
        hourlyRate: Number(calcRate) || 0,
        materials: Number(calcMaterials) || 0,
        rushPercent: Number(calcRush) || 0,
        licenseType: form.licenseType,
        depositPercent: form.depositPercent,
      }),
    [calcHours, calcRate, calcMaterials, calcRush, form.licenseType, form.depositPercent],
  );

  const termsLocked = Boolean(selectedJob?.acceptedAt || selectedJob?.depositPaidAt);

  function startNewJob() {
    setCreating(true);
    setSelectedId(null);
    setFeedback(null);
    setForm(
      emptyForm(
        commissionSettings.defaultLicense,
        commissionSettings.blackoutStart,
        commissionSettings.blackoutEnd,
      ),
    );
  }

  function applyTemplate(tpl: JobTemplate) {
    if (termsLocked) return;
    const due = computeQuotedDueDate(
      new Date(),
      tpl.turnaroundDays,
      commissionSettings.blackoutStart,
      commissionSettings.blackoutEnd,
    );
    setForm((current) => ({
      ...current,
      category: tpl.id,
      title: current.title.trim() ? current.title : tpl.defaultTitle,
      scope: tpl.defaultScope,
      medium: tpl.defaultMedium,
      depositPercent: tpl.depositPercent,
      turnaroundDays: tpl.turnaroundDays,
      dueDate: due.toISOString().slice(0, 10),
      licenseType: tpl.licenseType,
      revisionCap: tpl.revisionCap,
      killFeePercent: tpl.killFeePercent,
    }));
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        ...(selectedJob ? { id: selectedJob.id } : {}),
        title: form.title.trim(),
        category: form.category,
        status: form.status,
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        scope: form.scope,
        medium: form.medium.trim() || null,
        dimensions: form.dimensions.trim() || null,
        totalCents: totalCentsPreview,
        depositPercent: form.depositPercent,
        turnaroundDays: form.turnaroundDays,
        dueDate: form.dueDate || null,
        licenseType: form.licenseType,
        revisionCap: form.revisionCap,
        killFeePercent: form.killFeePercent,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/admin/jobs', {
        method: selectedJob ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save job');

      const saved: StudioJobRecord = data.job;
      setCreating(false);
      setSelectedId(saved.id);
      setFeedback({
        kind: 'success',
        text: selectedJob ? `Saved ${saved.jobNumber}.` : `Created ${saved.jobNumber}.`,
      });
      await loadJobs(saved.id);
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save job' });
    } finally {
      setSaving(false);
    }
  }

  async function runJobAction(action: string, extra?: Record<string, unknown>, successText?: string) {
    if (!selectedJob) return;
    setActionBusy(action);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedJob.id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setFeedback({ kind: 'success', text: successText || 'Updated.' });
      await loadJobs(selectedJob.id);
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed' });
    } finally {
      setActionBusy(null);
    }
  }

  async function handlePostProgress(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob || !progressMessage.trim()) return;
    await runJobAction(
      'progress_update',
      {
        message: progressMessage.trim(),
        imageUrl: progressImageUrl.trim() || null,
        nextStatus: progressNextStatus || null,
        notifyClient: progressNotify,
      },
      'Progress update posted.',
    );
    setProgressMessage('');
    setProgressImageUrl('');
    setProgressNextStatus('');
  }

  async function handleDeleteJob() {
    if (!selectedJob) return;
    if (!window.confirm(`Delete job "${selectedJob.title}" (${selectedJob.jobNumber})?`)) return;
    setActionBusy('delete');
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/jobs?id=${encodeURIComponent(selectedJob.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete job');
      setSelectedId(null);
      setFeedback({ kind: 'success', text: `Deleted ${selectedJob.jobNumber}.` });
      await loadJobs(null);
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Could not delete job' });
    } finally {
      setActionBusy(null);
    }
  }

  async function copyProposalLink(job: StudioJobRecord) {
    const url = `${window.location.origin}/proposals/${encodeURIComponent(job.shareToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(job.id);
      setFeedback({ kind: 'success', text: 'Proposal link copied to clipboard.' });
      window.setTimeout(() => setCopiedId((cur) => (cur === job.id ? null : cur)), 2000);
    } catch {
      setFeedback({ kind: 'error', text: `Copy link manually: ${url}` });
    }
  }

  async function saveTemplates() {
    setActionBusy('save_templates');
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_templates', templates: templatesDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save templates');
      setTemplates(data.templates);
      setTemplatesOpen(false);
      setFeedback({ kind: 'success', text: 'Job templates saved.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save templates' });
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Commission Jobs & Proposals</h2>
          <p className="text-sm text-gray-600">
            Quote custom work, share one link for deposit and balance payments, track proofs, and issue COAs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTemplatesDraft(templates.map((t) => ({ ...t })));
              setTemplatesOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Templates
          </button>
          <button
            type="button"
            onClick={startNewJob}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New job
          </button>
        </div>
      </div>

      {/* Status Filter Pills + Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'All' },
            ...JOB_PIPELINE_STEPS.map((s) => ({ key: s.status, label: s.shortLabel })),
            { key: 'on_hold', label: 'On hold' },
          ].map((pill) => {
            const count = pipelineCounts[pill.key] || 0;
            const active = statusFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setStatusFilter(pill.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pill.label}
                {count > 0 && <span className={`ml-1.5 ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, title, or job #..."
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm lg:w-64"
        />
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            feedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Split Workspace: Job List + Detail/Editor */}
      <div className={`grid grid-cols-1 gap-5 ${creating && jobs.length === 0 ? '' : 'lg:grid-cols-[320px_1fr]'}`}>
        {/* Left List */}
        {!(creating && jobs.length === 0) && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
              <FileText className="mx-auto h-7 w-7 text-gray-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-gray-900">
                {jobs.length === 0 ? 'No commission jobs yet' : 'No jobs match this filter'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Create a job here or click Create Job on any inquiry in Content → Inbox.
              </p>
              {jobs.length === 0 && (
                <button
                  type="button"
                  onClick={startNewJob}
                  className="btn-primary mt-3 px-3.5 py-1.5 text-xs font-medium"
                >
                  Create first job
                </button>
              )}
            </div>
          ) : (
            filteredJobs.map((job) => {
              const active = !creating && selectedId === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(job.id);
                    setFeedback(null);
                  }}
                  className={`w-full rounded-lg border p-3.5 text-left transition-colors ${
                    active
                      ? 'border-gray-900 bg-white shadow-sm ring-1 ring-gray-900'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{job.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${jobStatusTone(job.status)}`}>
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-600">{job.clientName}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span className="font-mono">{job.jobNumber}</span>
                    <span className="font-medium text-gray-900">
                      {job.totalCents > 0 ? formatCents(job.totalCents, job.currency) : 'Not priced'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
        )}

        {/* Right Detail / Editor */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          {!creating && !selectedJob ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Select a job on the left or click <strong>New job</strong> to draft a proposal.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Action Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {creating ? 'New Commission Job' : selectedJob?.title}
                    </h3>
                    {selectedJob && (
                      <span className="font-mono text-xs text-gray-500">{selectedJob.jobNumber}</span>
                    )}
                    {termsLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Terms locked
                      </span>
                    )}
                  </div>
                  {selectedJob && (
                    <p className="mt-1 text-xs text-gray-500">
                      Proposal link ready to share for acceptance, deposit, proof approval, and final balance.
                    </p>
                  )}
                </div>

                {selectedJob && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyProposalLink(selectedJob)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {copiedId === selectedJob.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === selectedJob.id ? 'Copied' : 'Copy proposal link'}
                    </button>
                    <Link
                      href={`/proposals/${encodeURIComponent(selectedJob.shareToken)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Preview proposal
                    </Link>
                    <button
                      type="button"
                      disabled={actionBusy === 'send_proposal'}
                      onClick={() => void runJobAction('send_proposal', undefined, 'Proposal sent to client.')}
                      className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      {actionBusy === 'send_proposal' ? 'Sending...' : 'Email proposal'}
                    </button>
                  </div>
                )}
              </div>

              {/* Payment & COA Status Bar for Existing Jobs */}
              {selectedJob && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                    <p className="text-xs font-medium text-gray-500">Deposit ({selectedJob.depositPercent}%)</p>
                    <p className="mt-0.5 text-base font-semibold text-gray-900">
                      {formatCents(selectedJob.depositCents, selectedJob.currency)}
                    </p>
                    {selectedJob.depositPaidAt ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Paid {new Date(selectedJob.depositPaidAt).toLocaleDateString()}
                      </p>
                    ) : selectedJob.depositCents > 0 ? (
                      <button
                        type="button"
                        disabled={actionBusy === 'mark_stage_paid'}
                        onClick={() =>
                          void runJobAction('mark_stage_paid', { stage: 'deposit' }, 'Deposit marked paid and terms locked.')
                        }
                        className="mt-1.5 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        Mark deposit paid (manual)
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-gray-400">No deposit required</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                    <p className="text-xs font-medium text-gray-500">Remaining Balance</p>
                    <p className="mt-0.5 text-base font-semibold text-gray-900">
                      {formatCents(selectedJob.balanceCents, selectedJob.currency)}
                    </p>
                    {selectedJob.balancePaidAt ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Paid {new Date(selectedJob.balancePaidAt).toLocaleDateString()}
                      </p>
                    ) : selectedJob.balanceCents > 0 ? (
                      <button
                        type="button"
                        disabled={actionBusy === 'mark_stage_paid'}
                        onClick={() =>
                          void runJobAction('mark_stage_paid', { stage: 'balance' }, 'Final balance marked paid.')
                        }
                        className="mt-1.5 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        Mark balance paid (manual)
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-gray-400">Paid in full upfront</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                    <p className="text-xs font-medium text-gray-500">Certificate of Authenticity</p>
                    {selectedJob.certificateCode ? (
                      <div className="mt-1 space-y-1">
                        <p className="font-mono text-xs font-semibold text-emerald-800">
                          {selectedJob.certificateCode}
                        </p>
                        <Link
                          href={`/verify/${encodeURIComponent(selectedJob.certificateCode)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
                        >
                          <Award className="h-3.5 w-3.5" aria-hidden="true" />
                          View / Print COA
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-xs text-gray-500">Auto-issued on final payment</p>
                        <button
                          type="button"
                          disabled={actionBusy === 'issue_coa'}
                          onClick={() => void runJobAction('issue_coa', undefined, 'Certificate of Authenticity issued.')}
                          className="mt-1 text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                        >
                          Issue COA now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* One-Tap Template Picker */}
              {!termsLocked && templates.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500">Apply template defaults</p>
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          form.category === tpl.id
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Form */}
              <form onSubmit={saveJob} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project title *</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Custom Botanical Watercolor Portrait (18x24)"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client name *</label>
                    <input
                      type="text"
                      required
                      value={form.clientName}
                      onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                      placeholder="Collector or client name"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client email *</label>
                    <input
                      type="email"
                      required
                      value={form.clientEmail}
                      onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
                      placeholder="client@example.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as JobStatus }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {JOB_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {JOB_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License tier</label>
                    <select
                      disabled={termsLocked}
                      value={form.licenseType}
                      onChange={(e) => setForm((f) => ({ ...f, licenseType: e.target.value as LicenseType }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      {LICENSE_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} ({opt.multiplier}x)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Medium</label>
                    <input
                      type="text"
                      disabled={termsLocked}
                      value={form.medium}
                      onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value }))}
                      placeholder="Oil on linen, ink on cotton paper..."
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dimensions</label>
                    <input
                      type="text"
                      disabled={termsLocked}
                      value={form.dimensions}
                      onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                      placeholder='e.g. 24" x 36"'
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Pricing & Studio Pricing Helper */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Pricing & Payment Terms
                    </span>
                    {!termsLocked && (
                      <button
                        type="button"
                        onClick={() => setPricingOpen((open) => !open)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
                      >
                        <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                        {pricingOpen ? 'Hide pricing helper' : 'Studio pricing helper'}
                      </button>
                    )}
                  </div>

                  {pricingOpen && !termsLocked && (
                    <div className="rounded-lg border border-blue-200 bg-white p-3.5 space-y-3">
                      <p className="text-xs text-gray-600">
                        Studio-only calculator. Factors in hours, materials, rush fee, and selected license multiplier ({LICENSE_DEFINITIONS[form.licenseType].multiplier}x).
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <label className="text-xs text-gray-700">
                          Hours
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={calcHours}
                            onChange={(e) => setCalcHours(e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-700">
                          Hourly ($)
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={calcRate}
                            onChange={(e) => setCalcRate(e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-700">
                          Materials ($)
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={calcMaterials}
                            onChange={(e) => setCalcMaterials(e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-700">
                          Rush fee (%)
                          <input
                            type="number"
                            min="0"
                            max="200"
                            step="5"
                            value={calcRush}
                            onChange={(e) => setCalcRush(e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-xs">
                        <span className="text-gray-600">
                          Suggested total: <strong className="text-sm text-gray-900">{formatCents(pricingCalc.totalCents)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              totalDollars: (pricingCalc.totalCents / 100).toFixed(2).replace(/\.00$/, ''),
                            }));
                            setPricingOpen(false);
                          }}
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                        >
                          Apply to quote
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="text-xs font-medium text-gray-700">
                      Total price ($)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={termsLocked}
                        value={form.totalDollars}
                        onChange={(e) => setForm((f) => ({ ...f, totalDollars: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-700">
                      Deposit (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={termsLocked}
                        value={form.depositPercent}
                        onChange={(e) => setForm((f) => ({ ...f, depositPercent: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-700">
                      Revisions
                      <input
                        type="number"
                        min="0"
                        max="20"
                        disabled={termsLocked}
                        value={form.revisionCap}
                        onChange={(e) => setForm((f) => ({ ...f, revisionCap: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-700">
                      Kill fee (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={termsLocked}
                        value={form.killFeePercent}
                        onChange={(e) => setForm((f) => ({ ...f, killFeePercent: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-gray-700">
                      Turnaround (days)
                      <input
                        type="number"
                        min="1"
                        max="365"
                        disabled={termsLocked}
                        value={form.turnaroundDays}
                        onChange={(e) => {
                          const days = Math.max(1, Number(e.target.value) || 1);
                          const due = computeQuotedDueDate(
                            new Date(),
                            days,
                            commissionSettings.blackoutStart,
                            commissionSettings.blackoutEnd,
                          );
                          setForm((f) => ({
                            ...f,
                            turnaroundDays: days,
                            dueDate: due.toISOString().slice(0, 10),
                          }));
                        }}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-700">
                      Target completion date
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-gray-600">
                    Split preview: <strong>{formatCents(depositCents)}</strong> deposit now,{' '}
                    <strong>{formatCents(balanceCents)}</strong> on delivery.
                    {commissionSettings.blackoutStart && commissionSettings.blackoutEnd && (
                      <span className="ml-1 text-amber-700">
                        (Studio blackout {commissionSettings.blackoutStart} to {commissionSettings.blackoutEnd} auto-applied.)
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Scope & deliverables (shown on client proposal)</label>
                  <textarea
                    rows={3}
                    disabled={termsLocked}
                    value={form.scope}
                    onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                    placeholder="Describe deliverables, framing, shipping/delivery expectations, and what the client provides."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Private studio notes (never shown to client)</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Reference links, framing vendor, internal reminders..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
                  {selectedJob ? (
                    <button
                      type="button"
                      disabled={actionBusy === 'delete'}
                      onClick={() => void handleDeleteJob()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete job
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        if (jobs[0]) setSelectedId(jobs[0].id);
                      }}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-5 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : selectedJob ? 'Save changes' : 'Create job'}
                  </button>
                </div>
              </form>

              {/* Progress / Proof Update Composer + Timeline */}
              {selectedJob && (
                <div className="border-t border-gray-200 pt-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Progress & Proof Updates</h4>
                    <p className="text-xs text-gray-500">
                      Post a work-in-progress note or sketch proof. Updates appear on the client proposal page.
                    </p>
                  </div>

                  <form onSubmit={handlePostProgress} className="rounded-lg border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
                    <textarea
                      rows={2}
                      value={progressMessage}
                      onChange={(e) => setProgressMessage(e.target.value)}
                      placeholder="e.g. Initial composition sketch is ready for your review!"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <input
                        type="url"
                        value={progressImageUrl}
                        onChange={(e) => setProgressImageUrl(e.target.value)}
                        placeholder="Optional proof image URL (https://...)"
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
                      />
                      <select
                        value={progressNextStatus}
                        onChange={(e) => setProgressNextStatus(e.target.value as '' | JobStatus)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="">Keep current status ({JOB_STATUS_LABELS[selectedJob.status]})</option>
                        <option value="awaiting_approval">Move to: Awaiting client proof approval</option>
                        <option value="in_progress">Move to: In progress</option>
                        <option value="delivered">Move to: Delivered (unlock balance payment)</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={progressNotify}
                          onChange={(e) => setProgressNotify(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Email client with proposal link
                      </label>
                      <button
                        type="submit"
                        disabled={actionBusy === 'progress_update' || !progressMessage.trim()}
                        className="rounded-md bg-gray-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {actionBusy === 'progress_update' ? 'Posting...' : 'Post update'}
                      </button>
                    </div>
                  </form>

                  {selectedJob.timeline.length > 0 && (
                    <ol className="space-y-2.5">
                      {[...selectedJob.timeline].reverse().map((entry) => (
                        <li key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2 text-gray-500">
                            <span className="font-medium capitalize text-gray-700">{entry.actor}</span>
                            <span>{new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{entry.message}</p>
                          {entry.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={entry.imageUrl}
                              alt="Progress proof"
                              className="mt-2 max-h-48 rounded-md border border-gray-200 object-contain"
                            />
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Templates Modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Commission Job Templates</h3>
                <p className="text-xs text-gray-500">Customize your default terms once and apply them in one tap.</p>
              </div>
              <button
                type="button"
                onClick={() => setTemplatesOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {templatesDraft.map((tpl, idx) => (
                <div key={tpl.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{tpl.name}</span>
                    <span className="text-xs uppercase text-gray-400">{tpl.id}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      value={tpl.defaultTitle}
                      onChange={(e) =>
                        setTemplatesDraft((list) =>
                          list.map((item, i) => (i === idx ? { ...item, defaultTitle: e.target.value } : item)),
                        )
                      }
                      placeholder="Default title"
                      className="rounded border border-gray-300 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      value={tpl.defaultMedium}
                      onChange={(e) =>
                        setTemplatesDraft((list) =>
                          list.map((item, i) => (i === idx ? { ...item, defaultMedium: e.target.value } : item)),
                        )
                      }
                      placeholder="Default medium"
                      className="rounded border border-gray-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={tpl.defaultScope}
                    onChange={(e) =>
                      setTemplatesDraft((list) =>
                        list.map((item, i) => (i === idx ? { ...item, defaultScope: e.target.value } : item)),
                      )
                    }
                    className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <label className="text-[11px] text-gray-600">
                      Deposit %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tpl.depositPercent}
                        onChange={(e) =>
                          setTemplatesDraft((list) =>
                            list.map((item, i) => (i === idx ? { ...item, depositPercent: Number(e.target.value) || 0 } : item)),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-gray-600">
                      Days
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={tpl.turnaroundDays}
                        onChange={(e) =>
                          setTemplatesDraft((list) =>
                            list.map((item, i) => (i === idx ? { ...item, turnaroundDays: Number(e.target.value) || 1 } : item)),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-gray-600">
                      Revisions
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={tpl.revisionCap}
                        onChange={(e) =>
                          setTemplatesDraft((list) =>
                            list.map((item, i) => (i === idx ? { ...item, revisionCap: Number(e.target.value) || 0 } : item)),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-gray-600">
                      Kill fee %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tpl.killFeePercent}
                        onChange={(e) =>
                          setTemplatesDraft((list) =>
                            list.map((item, i) => (i === idx ? { ...item, killFeePercent: Number(e.target.value) || 0 } : item)),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-gray-600">
                      License
                      <select
                        value={tpl.licenseType}
                        onChange={(e) =>
                          setTemplatesDraft((list) =>
                            list.map((item, i) => (i === idx ? { ...item, licenseType: e.target.value as LicenseType } : item)),
                          )
                        }
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        {LICENSE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.shortLabel}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setTemplatesOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy === 'save_templates'}
                onClick={() => void saveTemplates()}
                className="btn-primary px-4 py-2 text-xs font-medium disabled:opacity-50"
              >
                {actionBusy === 'save_templates' ? 'Saving...' : 'Save templates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
