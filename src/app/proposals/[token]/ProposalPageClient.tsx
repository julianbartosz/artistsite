'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  formatCents,
  JOB_PIPELINE_STEPS,
  JOB_STATUS_LABELS,
  jobStatusTone,
  LICENSE_DEFINITIONS,
  type StudioJobRecord,
} from '@/lib/jobs-shared';

type PublicProposalPayload = {
  job: Omit<StudioJobRecord, 'notes'>;
  brand: { siteName: string; siteUrl: string; supportEmail: string; primaryColor: string };
  checkoutMode: 'stripe' | 'manual';
  manualInstructions: string;
};

interface ProposalPageClientProps {
  token: string;
  initialData: PublicProposalPayload;
  returnSessionId?: string;
  returnPaidStage?: string;
  returnCancelled?: boolean;
}

export default function ProposalPageClient({
  token,
  initialData,
  returnSessionId,
  returnPaidStage,
  returnCancelled,
}: ProposalPageClientProps) {
  const [data, setData] = useState<PublicProposalPayload>(initialData);
  const [agreed, setAgreed] = useState(Boolean(initialData.job.acceptedAt));
  const [submitting, setSubmitting] = useState<'deposit' | 'balance' | 'approve' | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [banner, setBanner] = useState<{ kind: 'success' | 'info' | 'error'; text: string } | null>(
    returnCancelled
      ? { kind: 'info', text: 'Checkout was cancelled. Your proposal is still open whenever you are ready.' }
      : null,
  );

  // If returning from Stripe Checkout with session_id, verify immediately via GET /api/proposals/[token]
  useEffect(() => {
    if (!returnSessionId) return;
    let cancelledEffect = false;
    async function syncPaidReturn() {
      try {
        const res = await fetch(
          `/api/proposals/${encodeURIComponent(token)}?session_id=${encodeURIComponent(returnSessionId!)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const fresh = (await res.json()) as PublicProposalPayload;
        if (!cancelledEffect) {
          setData(fresh);
          if (returnPaidStage === 'balance' && fresh.job.balancePaidAt) {
            setBanner({ kind: 'success', text: 'Final balance received! Thank you so much for collecting.' });
          } else if (fresh.job.depositPaidAt) {
            setBanner({
              kind: 'success',
              text: 'Deposit received and terms locked! Your project is officially on the studio calendar.',
            });
          }
        }
      } catch {
        // Non-fatal: webhook will also finalize.
      }
    }
    void syncPaidReturn();
    return () => {
      cancelledEffect = true;
    };
  }, [returnSessionId, returnPaidStage, token]);

  const { job, brand, checkoutMode, manualInstructions } = data;
  const licenseDef = LICENSE_DEFINITIONS[job.licenseType];
  const termsLocked = Boolean(job.acceptedAt || job.depositPaidAt);
  const activeStepIndex = JOB_PIPELINE_STEPS.findIndex((step) => step.status === job.status);

  const canPayDeposit =
    !job.depositPaidAt &&
    job.depositCents > 0 &&
    job.status !== 'cancelled' &&
    job.status !== 'final_paid';

  const canPayBalance =
    (Boolean(job.depositPaidAt) || job.depositCents === 0) &&
    !job.balancePaidAt &&
    job.balanceCents > 0 &&
    job.status !== 'cancelled' &&
    job.status !== 'final_paid';

  const canApproveProof = job.status === 'awaiting_approval';

  const handlePay = async (stage: 'deposit' | 'balance') => {
    if (stage === 'deposit' && !agreed) {
      setBanner({ kind: 'error', text: 'Please confirm that you accept the project terms before continuing.' });
      return;
    }
    setSubmitting(stage);
    setBanner(null);
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: stage === 'deposit' ? 'pay_deposit' : 'pay_balance' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not start payment');

      if (json.mode === 'stripe' && typeof json.url === 'string') {
        window.location.href = json.url;
        return;
      }

      setBanner({
        kind: 'success',
        text: `Request recorded (${json.orderNumber}). ${manualInstructions || `${brand.siteName} will follow up with payment details shortly.`}`,
      });
      // Refresh proposal data
      const refresh = await fetch(`/api/proposals/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (refresh.ok) setData(await refresh.json());
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not start payment' });
    } finally {
      setSubmitting(null);
    }
  };

  const handleApproveProof = async () => {
    setSubmitting('approve');
    setBanner(null);
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_proof', note: approvalNote }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not approve proof');
      setApprovalNote('');
      setBanner({ kind: 'success', text: 'Proof approved! The studio has been notified to move forward.' });
      const refresh = await fetch(`/api/proposals/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (refresh.ok) setData(await refresh.json());
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not approve proof' });
    } finally {
      setSubmitting(null);
    }
  };

  const progressUpdates = job.timeline.filter((entry) => entry.type === 'proof' || entry.type === 'approval');

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Top studio identity bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm font-semibold tracking-wide text-gray-900 hover:underline">
              {brand.siteName}
            </Link>
            <p className="text-xs text-gray-500">Custom Project Proposal · {job.jobNumber}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${jobStatusTone(job.status)}`}>
            {JOB_STATUS_LABELS[job.status]}
          </span>
        </div>

        {banner && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              banner.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : banner.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Main Proposal Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Prepared for {job.clientName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{job.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
              {job.medium && <span>{job.medium}</span>}
              {job.dimensions && <span>· {job.dimensions}</span>}
              {job.dueDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  Est. completion {new Date(job.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* Visual progress stepper */}
            {job.status !== 'cancelled' && job.status !== 'on_hold' && (
              <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label="Project progress">
                {JOB_PIPELINE_STEPS.map((step, idx) => {
                  const done = activeStepIndex >= idx;
                  const current = activeStepIndex === idx;
                  return (
                    <div key={step.status} className="flex flex-col items-center text-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          done
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-300 bg-white text-gray-400'
                        } ${current ? 'ring-2 ring-gray-900/20' : ''}`}
                      >
                        {done && !current ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span className={`mt-1 text-[11px] leading-tight ${done ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                        {step.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scope & Terms */}
          <div className="space-y-6 p-6 sm:p-8">
            {job.scope && (
              <div>
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Project Scope
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{job.scope}</p>
              </div>
            )}

            {/* Terms & License Grid */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <ShieldCheck className="h-4 w-4 text-gray-700" aria-hidden="true" />
                  License &amp; Studio Terms
                </h2>
                {termsLocked && job.acceptedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Accepted {new Date(job.acceptedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Usage License</p>
                  <p className="mt-0.5 font-semibold text-gray-900">{licenseDef.label}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Included Revisions</p>
                  <p className="mt-0.5 font-semibold text-gray-900">
                    Up to {job.revisionCap} round{job.revisionCap === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Turnaround / Kill Fee</p>
                  <p className="mt-0.5 font-semibold text-gray-900">
                    ~{job.turnaroundDays} days · {job.killFeePercent}% kill fee
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-gray-600">
                {job.termsSnapshot?.licenseClause || licenseDef.termsClause}
              </p>
              <p className="text-xs leading-relaxed text-gray-500">
                If cancelled after work begins, a {job.killFeePercent}% kill fee covers reserved studio time and materials. Additional revisions beyond {job.revisionCap} round{job.revisionCap === 1 ? '' : 's'} are quoted separately before work proceeds.
              </p>
            </div>

            {/* Payment Schedule */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-3">
                <h2 className="text-sm font-semibold text-gray-900">Payment Schedule</h2>
                <p className="text-xl font-bold text-gray-900">
                  {formatCents(job.totalCents, job.currency)}
                </p>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {job.depositPaidAt ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    )}
                    <span className="text-gray-800">
                      Deposit to begin ({job.depositPercent}%)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">
                      {formatCents(job.depositCents, job.currency)}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {job.depositPaidAt
                        ? `Paid ${new Date(job.depositPaidAt).toLocaleDateString()}`
                        : 'Due to accept'}
                    </span>
                  </div>
                </div>

                {job.balanceCents > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {job.balancePaidAt ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      )}
                      <span className="text-gray-800">Final balance on delivery</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">
                        {formatCents(job.balanceCents, job.currency)}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {job.balancePaidAt
                          ? `Paid ${new Date(job.balancePaidAt).toLocaleDateString()}`
                          : job.status === 'delivered'
                            ? 'Due now'
                            : 'Due at delivery'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {canPayDeposit && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <span>
                      I accept the scope, {licenseDef.label.toLowerCase()}, revision limit, and payment terms above. Paying the deposit confirms this agreement.
                    </span>
                  </label>
                  <button
                    type="button"
                    data-testid="proposal-pay-deposit-btn"
                    disabled={submitting !== null}
                    onClick={() => void handlePay('deposit')}
                    className="w-full rounded-xl bg-gray-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {submitting === 'deposit'
                      ? 'Preparing checkout...'
                      : checkoutMode === 'manual'
                        ? `Accept terms & request deposit invoice (${formatCents(job.depositCents, job.currency)})`
                        : `Accept terms & pay deposit (${formatCents(job.depositCents, job.currency)})`}
                  </button>
                </div>
              )}

              {canPayBalance && (
                <div className="border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    data-testid="proposal-pay-balance-btn"
                    disabled={submitting !== null}
                    onClick={() => void handlePay('balance')}
                    className="w-full rounded-xl bg-gray-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {submitting === 'balance'
                      ? 'Preparing checkout...'
                      : checkoutMode === 'manual'
                        ? `Request final balance invoice (${formatCents(job.balanceCents, job.currency)})`
                        : `Pay final balance (${formatCents(job.balanceCents, job.currency)})`}
                  </button>
                </div>
              )}

              {job.certificateCode && (
                <div className="border-t border-gray-100 pt-4">
                  <Link
                    href={`/verify/${encodeURIComponent(job.certificateCode)}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    <Award className="h-4 w-4" aria-hidden="true" />
                    View Certificate of Authenticity ({job.certificateCode})
                  </Link>
                </div>
              )}
            </div>

            {/* Proof Approval Box */}
            {canApproveProof && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-800" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-amber-950">Proof Ready for Your Approval</h2>
                </div>
                <p className="text-xs text-amber-900">
                  Review the latest studio update below. Approve when you are happy for the artist to proceed with the final piece, or reply directly if you want a revision.
                </p>
                <input
                  type="text"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Optional note (e.g. Love the composition, go ahead!)"
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  data-testid="proposal-approve-proof-btn"
                  disabled={submitting !== null}
                  onClick={() => void handleApproveProof()}
                  className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {submitting === 'approve' ? 'Saving...' : 'Approve proof & proceed'}
                </button>
              </div>
            )}

            {/* Progress & Proof Updates */}
            {progressUpdates.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Studio Progress &amp; Proofs
                </h2>
                <div className="space-y-3">
                  {progressUpdates.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="font-semibold text-gray-800">
                          {entry.actor === 'client' ? job.clientName : brand.siteName}
                        </span>
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-gray-800">{entry.message}</p>
                      {entry.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={entry.imageUrl}
                          alt="Studio work in progress"
                          className="max-h-96 w-auto rounded-lg border border-gray-200 object-contain"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          Questions about this proposal?{' '}
          {brand.supportEmail ? (
            <a href={`mailto:${brand.supportEmail}`} className="font-medium text-gray-700 underline">
              Email {brand.siteName}
            </a>
          ) : (
            <Link href="/contact" className="font-medium text-gray-700 underline">
              Contact the studio
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
