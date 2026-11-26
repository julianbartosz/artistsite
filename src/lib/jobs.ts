import 'server-only';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getConfig, setConfig } from '@/lib/config';
import { getStripe } from '@/lib/stripe';
import { brandedEmailHtml, getEmailBrand, getEmailDeliveryStatus, sendTemplateEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/email-shell';
import { createStudioThread } from '@/lib/studio-inbox';
import { issueCertificateForJob } from '@/lib/certificates';
import {
  clampInt,
  computeDepositAndBalance,
  computeQuotedDueDate,
  formatCents,
  JOB_STATUS_LABELS,
  LICENSE_DEFINITIONS,
  normalizeCommissionStatus,
  normalizeJobCategory,
  normalizeJobStatus,
  normalizeJobTemplates,
  normalizeLicenseType,
  type CommissionAvailabilityStatus,
  type JobCategory,
  type JobStatus,
  type JobTemplate,
  type JobTermsSnapshot,
  type JobTimelineEntry,
  type LicenseType,
  type StudioJobRecord,
} from '@/lib/jobs-shared';

const JOB_TEMPLATES_SETTING_KEY = 'JOB_TEMPLATES_JSON';

export interface CommissionSettingsSnapshot {
  status: CommissionAvailabilityStatus;
  note: string;
  defaultLicense: LicenseType;
  blackoutStart: string;
  blackoutEnd: string;
}

export async function getCommissionSettings(): Promise<CommissionSettingsSnapshot> {
  const [statusRaw, noteRaw, defaultLicenseRaw, blackoutStartRaw, blackoutEndRaw] = await Promise.all([
    getConfig('COMMISSION_STATUS'),
    getConfig('COMMISSION_WAITLIST_NOTE'),
    getConfig('DEFAULT_LICENSE_TYPE'),
    getConfig('STUDIO_BLACKOUT_START'),
    getConfig('STUDIO_BLACKOUT_END'),
  ]);
  return {
    status: normalizeCommissionStatus(statusRaw),
    note: (noteRaw || '').trim(),
    defaultLicense: normalizeLicenseType(defaultLicenseRaw, 'personal'),
    blackoutStart: (blackoutStartRaw || '').trim(),
    blackoutEnd: (blackoutEndRaw || '').trim(),
  };
}

export async function getJobTemplates(): Promise<JobTemplate[]> {
  const raw = await getConfig(JOB_TEMPLATES_SETTING_KEY);
  if (!raw) return normalizeJobTemplates(null);
  try {
    return normalizeJobTemplates(JSON.parse(raw));
  } catch {
    return normalizeJobTemplates(null);
  }
}

export async function saveJobTemplates(templates: JobTemplate[]): Promise<JobTemplate[]> {
  const normalized = normalizeJobTemplates(templates);
  await setConfig(JOB_TEMPLATES_SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}

function generateJobNumber(): string {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `JOB-${stamp}${suffix}`;
}

function generateShareToken(): string {
  return randomBytes(16).toString('hex');
}

function parseTimeline(raw: unknown): JobTimelineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : randomBytes(4).toString('hex'),
      type:
        entry.type === 'proposal' ||
        entry.type === 'payment' ||
        entry.type === 'proof' ||
        entry.type === 'approval' ||
        entry.type === 'note'
          ? entry.type
          : 'status',
      status: entry.status ? normalizeJobStatus(entry.status) : undefined,
      message: typeof entry.message === 'string' ? entry.message : '',
      imageUrl: typeof entry.imageUrl === 'string' && entry.imageUrl.trim() ? entry.imageUrl.trim() : undefined,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      actor: entry.actor === 'client' || entry.actor === 'system' ? entry.actor : 'artist',
    }));
}

function toJobRecord(
  row: {
    id: string;
    jobNumber: string;
    shareToken: string;
    title: string;
    category: string;
    status: string;
    clientName: string;
    clientEmail: string;
    threadId: string | null;
    scope: string;
    medium: string | null;
    dimensions: string | null;
    totalCents: number;
    depositPercent: number;
    depositCents: number;
    balanceCents: number;
    currency: string;
    turnaroundDays: number;
    dueDate: Date | null;
    licenseType: string;
    revisionCap: number;
    killFeePercent: number;
    termsSnapshot: unknown;
    acceptedAt: Date | null;
    depositOrderId: string | null;
    balanceOrderId: string | null;
    depositPaidAt: Date | null;
    balancePaidAt: Date | null;
    notes: string | null;
    timeline: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  certificateCode?: string | null,
): StudioJobRecord {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    shareToken: row.shareToken,
    title: row.title,
    category: normalizeJobCategory(row.category),
    status: normalizeJobStatus(row.status),
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    threadId: row.threadId,
    scope: row.scope,
    medium: row.medium,
    dimensions: row.dimensions,
    totalCents: row.totalCents,
    depositPercent: row.depositPercent,
    depositCents: row.depositCents,
    balanceCents: row.balanceCents,
    currency: row.currency || 'USD',
    turnaroundDays: row.turnaroundDays,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    licenseType: normalizeLicenseType(row.licenseType),
    revisionCap: row.revisionCap,
    killFeePercent: row.killFeePercent,
    termsSnapshot:
      row.termsSnapshot && typeof row.termsSnapshot === 'object'
        ? (row.termsSnapshot as JobTermsSnapshot)
        : null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    depositOrderId: row.depositOrderId,
    balanceOrderId: row.balanceOrderId,
    depositPaidAt: row.depositPaidAt ? row.depositPaidAt.toISOString() : null,
    balancePaidAt: row.balancePaidAt ? row.balancePaidAt.toISOString() : null,
    notes: row.notes,
    timeline: parseTimeline(row.timeline),
    certificateCode: certificateCode ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeTimelineEntry(
  partial: Omit<JobTimelineEntry, 'id' | 'createdAt'>,
): JobTimelineEntry {
  return {
    id: randomBytes(5).toString('hex'),
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export async function listJobs(filters?: { status?: string | null; search?: string | null }): Promise<StudioJobRecord[]> {
  const status = filters?.status?.trim();
  const search = filters?.search?.trim();

  const where: Record<string, unknown> = {};
  if (status === 'active') {
    where.status = { in: ['inquiry', 'quoted', 'deposit_paid', 'awaiting_approval', 'in_progress', 'delivered'] };
  } else if (status === 'awaiting_balance') {
    where.status = 'delivered';
    where.balancePaidAt = null;
  } else if (status) {
    where.status = normalizeJobStatus(status);
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { jobNumber: { contains: search, mode: 'insensitive' } },
      { clientName: { contains: search, mode: 'insensitive' } },
      { clientEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  const rows = await db.studioJob.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
  });

  if (rows.length === 0) return [];

  const certs = await db.certificateOfAuthenticity.findMany({
    where: { jobId: { in: rows.map((r) => r.id) }, revokedAt: null },
    select: { jobId: true, code: true },
  });
  const certMap = new Map(certs.filter((c) => c.jobId).map((c) => [c.jobId as string, c.code]));

  return rows.map((row) => toJobRecord(row, certMap.get(row.id) ?? null));
}

export async function getJobById(id: string): Promise<StudioJobRecord | null> {
  const row = await db.studioJob.findUnique({ where: { id } });
  if (!row) return null;
  const cert = await db.certificateOfAuthenticity.findFirst({
    where: { jobId: row.id, revokedAt: null },
    select: { code: true },
  });
  return toJobRecord(row, cert?.code ?? null);
}

/** Public-safe view for `/proposals/[token]` — strips internal artist notes. */
export async function getPublicJobByToken(token: string): Promise<{
  job: Omit<StudioJobRecord, 'notes'>;
  brand: { siteName: string; siteUrl: string; supportEmail: string; primaryColor: string };
  checkoutMode: 'stripe' | 'manual';
  manualInstructions: string;
} | null> {
  const cleaned = token.trim();
  if (!cleaned) return null;
  const row = await db.studioJob.findUnique({ where: { shareToken: cleaned } });
  if (!row) return null;

  const [cert, brand, checkoutModeRaw, manualInstructions, supportEmailRaw, contactEmailRaw] = await Promise.all([
    db.certificateOfAuthenticity.findFirst({
      where: { jobId: row.id, revokedAt: null },
      select: { code: true },
    }),
    getEmailBrand(),
    getConfig('CHECKOUT_MODE'),
    getConfig('MANUAL_PAYMENT_INSTRUCTIONS'),
    getConfig('SUPPORT_EMAIL'),
    getConfig('CONTACT_EMAIL'),
  ]);

  const full = toJobRecord(row, cert?.code ?? null);
  const { notes: _omit, ...publicJob } = full;
  void _omit;

  return {
    job: publicJob,
    brand: {
      siteName: brand.siteName,
      siteUrl: brand.siteUrl,
      supportEmail: (supportEmailRaw || contactEmailRaw || '').trim(),
      primaryColor: brand.primaryColor,
    },
    checkoutMode: checkoutModeRaw === 'manual' ? 'manual' : 'stripe',
    manualInstructions: (manualInstructions || '').trim(),
  };
}

export async function createJob(input: {
  title: string;
  category?: JobCategory;
  status?: JobStatus;
  clientName: string;
  clientEmail: string;
  threadId?: string | null;
  scope?: string;
  medium?: string | null;
  dimensions?: string | null;
  totalCents?: number;
  depositPercent?: number;
  turnaroundDays?: number;
  dueDate?: string | null;
  licenseType?: LicenseType;
  revisionCap?: number;
  killFeePercent?: number;
  notes?: string | null;
}): Promise<StudioJobRecord> {
  const title = input.title.trim().slice(0, 140);
  const clientName = input.clientName.trim().slice(0, 120) || 'Client';
  const clientEmail = input.clientEmail.trim().toLowerCase().slice(0, 180);
  if (!title) throw new Error('Job title is required.');
  if (!clientEmail || !clientEmail.includes('@')) throw new Error('Valid client email is required.');

  const settings = await getCommissionSettings();
  const split = computeDepositAndBalance(input.totalCents ?? 0, input.depositPercent ?? 50);
  const turnaroundDays = clampInt(input.turnaroundDays, 1, 365, 21);

  let dueDate: Date | null = null;
  if (input.dueDate) {
    const parsed = new Date(input.dueDate);
    if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
  } else {
    dueDate = computeQuotedDueDate(new Date(), turnaroundDays, settings.blackoutStart, settings.blackoutEnd);
  }

  const initialStatus = normalizeJobStatus(input.status, split.totalCents > 0 ? 'quoted' : 'inquiry');
  const timeline = [
    makeTimelineEntry({
      type: 'status',
      status: initialStatus,
      message: `Job created (${JOB_STATUS_LABELS[initialStatus]})`,
      actor: 'artist',
    }),
  ];

  const created = await db.studioJob.create({
    data: {
      jobNumber: generateJobNumber(),
      shareToken: generateShareToken(),
      title,
      category: normalizeJobCategory(input.category),
      status: initialStatus,
      clientName,
      clientEmail,
      threadId: input.threadId?.trim() || null,
      scope: (input.scope || '').trim().slice(0, 4000),
      medium: input.medium?.trim().slice(0, 160) || null,
      dimensions: input.dimensions?.trim().slice(0, 120) || null,
      totalCents: split.totalCents,
      depositPercent: split.depositPercent,
      depositCents: split.depositCents,
      balanceCents: split.balanceCents,
      turnaroundDays,
      dueDate,
      licenseType: normalizeLicenseType(input.licenseType, settings.defaultLicense),
      revisionCap: clampInt(input.revisionCap, 0, 20, 2),
      killFeePercent: clampInt(input.killFeePercent, 0, 100, 25),
      notes: input.notes?.trim().slice(0, 2000) || null,
      timeline: timeline as unknown as object,
    },
  });

  return toJobRecord(created, null);
}

/** Converts an existing Studio Inbox thread into a StudioJob (idempotent if already converted). */
export async function createJobFromThread(threadId: string): Promise<{ job: StudioJobRecord; existed: boolean }> {
  const existing = await db.studioJob.findFirst({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    const full = await getJobById(existing.id);
    if (full) return { job: full, existed: true };
  }

  const thread = await db.studioMessageThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 3 } },
  });
  if (!thread) throw new Error('Inbox conversation not found.');

  const templates = await getJobTemplates();
  const defaultTemplate = templates[0];
  const initialMessage = thread.messages[0]?.body?.trim() || '';

  const job = await createJob({
    title: thread.subject || defaultTemplate?.defaultTitle || 'Custom Commission',
    category: 'portrait',
    status: 'inquiry',
    clientName: thread.userName || thread.userEmail.split('@')[0] || 'Client',
    clientEmail: thread.userEmail,
    threadId: thread.id,
    scope: initialMessage || defaultTemplate?.defaultScope || '',
    medium: defaultTemplate?.defaultMedium || '',
    depositPercent: defaultTemplate?.depositPercent ?? 50,
    turnaroundDays: defaultTemplate?.turnaroundDays ?? 21,
    licenseType: defaultTemplate?.licenseType ?? 'personal',
    revisionCap: defaultTemplate?.revisionCap ?? 2,
    killFeePercent: defaultTemplate?.killFeePercent ?? 25,
  });

  // Mark thread stage as "quoted" / "contacted" if still "new"
  if (thread.crmStage === 'new') {
    await db.studioMessageThread
      .update({ where: { id: thread.id }, data: { crmStage: 'contacted' } })
      .catch(() => undefined);
  }

  return { job, existed: false };
}

export async function updateJob(
  id: string,
  patch: {
    title?: string;
    category?: JobCategory;
    status?: JobStatus;
    clientName?: string;
    clientEmail?: string;
    scope?: string;
    medium?: string | null;
    dimensions?: string | null;
    totalCents?: number;
    depositPercent?: number;
    turnaroundDays?: number;
    dueDate?: string | null;
    licenseType?: LicenseType;
    revisionCap?: number;
    killFeePercent?: number;
    notes?: string | null;
  },
): Promise<StudioJobRecord> {
  const existing = await db.studioJob.findUnique({ where: { id } });
  if (!existing) throw new Error('Job not found.');

  const locked = Boolean(existing.acceptedAt || existing.depositPaidAt);
  const data: Record<string, unknown> = {};
  const timeline = parseTimeline(existing.timeline);

  if (patch.title !== undefined && patch.title.trim()) {
    data.title = patch.title.trim().slice(0, 140);
  }
  if (patch.category !== undefined) {
    data.category = normalizeJobCategory(patch.category);
  }
  if (patch.clientName !== undefined && patch.clientName.trim()) {
    data.clientName = patch.clientName.trim().slice(0, 120);
  }
  if (patch.clientEmail !== undefined && patch.clientEmail.trim().includes('@')) {
    data.clientEmail = patch.clientEmail.trim().toLowerCase().slice(0, 180);
  }
  if (patch.notes !== undefined) {
    data.notes = patch.notes?.trim().slice(0, 2000) || null;
  }
  if (patch.dueDate !== undefined) {
    if (!patch.dueDate) {
      data.dueDate = null;
    } else {
      const parsed = new Date(patch.dueDate);
      if (!Number.isNaN(parsed.getTime())) data.dueDate = parsed;
    }
  }

  // Commercial terms can only be edited before client accepts via deposit.
  if (!locked) {
    if (patch.scope !== undefined) data.scope = patch.scope.trim().slice(0, 4000);
    if (patch.medium !== undefined) data.medium = patch.medium?.trim().slice(0, 160) || null;
    if (patch.dimensions !== undefined) data.dimensions = patch.dimensions?.trim().slice(0, 120) || null;
    if (patch.totalCents !== undefined || patch.depositPercent !== undefined) {
      const split = computeDepositAndBalance(
        patch.totalCents ?? existing.totalCents,
        patch.depositPercent ?? existing.depositPercent,
      );
      data.totalCents = split.totalCents;
      data.depositPercent = split.depositPercent;
      data.depositCents = split.depositCents;
      data.balanceCents = split.balanceCents;
    }
    if (patch.turnaroundDays !== undefined) {
      data.turnaroundDays = clampInt(patch.turnaroundDays, 1, 365, existing.turnaroundDays);
    }
    if (patch.licenseType !== undefined) {
      data.licenseType = normalizeLicenseType(patch.licenseType);
    }
    if (patch.revisionCap !== undefined) {
      data.revisionCap = clampInt(patch.revisionCap, 0, 20, existing.revisionCap);
    }
    if (patch.killFeePercent !== undefined) {
      data.killFeePercent = clampInt(patch.killFeePercent, 0, 100, existing.killFeePercent);
    }
  }

  if (patch.status !== undefined) {
    const nextStatus = normalizeJobStatus(patch.status);
    if (nextStatus !== existing.status) {
      data.status = nextStatus;
      timeline.push(
        makeTimelineEntry({
          type: 'status',
          status: nextStatus,
          message: `Status updated to ${JOB_STATUS_LABELS[nextStatus]}`,
          actor: 'artist',
        }),
      );
      data.timeline = timeline as unknown as object;
    }
  }

  await db.studioJob.update({ where: { id }, data });
  const updated = await getJobById(id);
  if (!updated) throw new Error('Job not found after update.');
  return updated;
}

export async function deleteJob(id: string): Promise<void> {
  await db.studioJob.deleteMany({ where: { id } });
}

export async function sendProposalEmail(jobId: string): Promise<{
  delivered: boolean;
  proposalUrl: string;
  job: StudioJobRecord;
}> {
  const existing = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error('Job not found.');
  if (existing.totalCents <= 0) {
    throw new Error('Set a project total before sending the proposal.');
  }

  const [brand, delivery] = await Promise.all([getEmailBrand(), getEmailDeliveryStatus()]);
  const proposalUrl = `${brand.siteUrl}/proposals/${encodeURIComponent(existing.shareToken)}`;
  const licenseDef = LICENSE_DEFINITIONS[normalizeLicenseType(existing.licenseType)];
  const timeline = parseTimeline(existing.timeline);
  const nextStatus: JobStatus = existing.status === 'inquiry' ? 'quoted' : normalizeJobStatus(existing.status);

  let delivered = false;
  if (delivery.mode === 'smtp') {
    const subject = `Proposal ready: ${existing.title} (${existing.jobNumber})`;
    const html = brandedEmailHtml(brand, {
      title: `Proposal for ${existing.title}`,
      intro: `Hi ${escapeHtml(existing.clientName)},<br><br>Your custom proposal is ready to review. Paying the deposit online accepts the terms and reserves your spot on the studio calendar.`,
      sections: [
        {
          heading: 'Summary',
          html: `<p style="margin:0;color:#374151;">Total: <strong>${escapeHtml(formatCents(existing.totalCents, existing.currency))}</strong><br>Deposit to begin (${existing.depositPercent}%): <strong>${escapeHtml(formatCents(existing.depositCents, existing.currency))}</strong><br>Balance on delivery: ${escapeHtml(formatCents(existing.balanceCents, existing.currency))}<br>License: ${escapeHtml(licenseDef.label)}</p>`,
        },
      ],
      cta: {
        label: 'Review Proposal & Pay Deposit',
        href: proposalUrl,
      },
      closing: 'Reply anytime if you would like any adjustments before accepting.',
    });
    const text = `Hi ${existing.clientName},\n\nYour proposal for ${existing.title} is ready: ${proposalUrl}\nTotal: ${formatCents(existing.totalCents, existing.currency)} (${existing.depositPercent}% deposit to begin).\n`;
    delivered = await sendTemplateEmail(existing.clientEmail, { subject, html, text }).catch(() => false);
  }

  timeline.push(
    makeTimelineEntry({
      type: 'proposal',
      status: nextStatus,
      message: delivered
        ? `Proposal emailed to ${existing.clientEmail}`
        : `Proposal prepared for ${existing.clientEmail} (email delivery is off; share link directly)`,
      actor: 'artist',
    }),
  );

  await db.studioJob.update({
    where: { id: jobId },
    data: { status: nextStatus, timeline: timeline as unknown as object },
  });

  const job = await getJobById(jobId);
  if (!job) throw new Error('Job not found.');
  return { delivered, proposalUrl, job };
}

export async function postJobProgressUpdate(
  jobId: string,
  input: {
    message: string;
    imageUrl?: string | null;
    nextStatus?: JobStatus | null;
    notifyClient?: boolean;
  },
): Promise<{ job: StudioJobRecord; emailed: boolean }> {
  const existing = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error('Job not found.');

  const message = input.message.trim().slice(0, 2000);
  if (!message) throw new Error('Update note is required.');

  const imageUrl = input.imageUrl?.trim() || undefined;
  const nextStatus = input.nextStatus ? normalizeJobStatus(input.nextStatus) : normalizeJobStatus(existing.status);
  const timeline = parseTimeline(existing.timeline);
  timeline.push(
    makeTimelineEntry({
      type: 'proof',
      status: nextStatus,
      message,
      imageUrl,
      actor: 'artist',
    }),
  );

  await db.studioJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      timeline: timeline as unknown as object,
    },
  });

  let emailed = false;
  if (input.notifyClient !== false) {
    const [brand, delivery] = await Promise.all([getEmailBrand(), getEmailDeliveryStatus()]);
    if (delivery.mode === 'smtp') {
      const proposalUrl = `${brand.siteUrl}/proposals/${encodeURIComponent(existing.shareToken)}`;
      const isDelivery = nextStatus === 'delivered';
      const isApproval = nextStatus === 'awaiting_approval';
      const subject = isDelivery
        ? `Work delivered: ${existing.title} (${existing.jobNumber})`
        : isApproval
          ? `Proof ready for your review: ${existing.title}`
          : `Studio update on ${existing.title}`;
      const ctaLabel = isDelivery && existing.balanceCents > 0 && !existing.balancePaidAt
        ? `Review & Pay Final Balance (${formatCents(existing.balanceCents, existing.currency)})`
        : isApproval
          ? 'View Proof & Approve'
          : 'View Project Update';
      const html = brandedEmailHtml(brand, {
        title: subject,
        intro: `Hi ${escapeHtml(existing.clientName)},<br><br>${escapeHtml(message).replace(/\n/g, '<br>')}`,
        sections: imageUrl
          ? [{ html: `<p style="margin:0;"><img src="${escapeHtml(imageUrl)}" alt="Work in progress" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" /></p>` }]
          : [],
        cta: { label: ctaLabel, href: proposalUrl },
      });
      const text = `Hi ${existing.clientName},\n\n${message}\n\nView project: ${proposalUrl}`;
      emailed = await sendTemplateEmail(existing.clientEmail, { subject, html, text }).catch(() => false);
    }
  }

  const job = await getJobById(jobId);
  if (!job) throw new Error('Job not found.');
  return { job, emailed };
}

export async function approveJobProofByToken(token: string, clientNote?: string): Promise<StudioJobRecord> {
  const row = await db.studioJob.findUnique({ where: { shareToken: token.trim() } });
  if (!row) throw new Error('Proposal not found.');
  if (row.status !== 'awaiting_approval') {
    throw new Error('This project is not currently waiting on proof approval.');
  }

  const timeline = parseTimeline(row.timeline);
  const noteText = clientNote?.trim().slice(0, 500);
  timeline.push(
    makeTimelineEntry({
      type: 'approval',
      status: 'in_progress',
      message: noteText ? `Client approved proof: "${noteText}"` : 'Client approved proof to proceed.',
      actor: 'client',
    }),
  );

  await db.studioJob.update({
    where: { id: row.id },
    data: {
      status: 'in_progress',
      timeline: timeline as unknown as object,
    },
  });

  await createStudioThread({
    subject: `Proof approved: ${row.title} (${row.jobNumber})`,
    userEmail: row.clientEmail,
    userName: row.clientName,
    initialBody: noteText
      ? `${row.clientName} approved the proof on ${row.jobNumber}: "${noteText}"`
      : `${row.clientName} approved the proof on ${row.jobNumber} and cleared work to proceed.`,
    senderRole: 'buyer',
    tags: ['commission'],
  }).catch(() => undefined);

  const updated = await getJobById(row.id);
  if (!updated) throw new Error('Job not found.');
  return updated;
}

/**
 * Starts a Deposit or Balance payment linked to one StudioJob via the existing Order + Stripe plumbing.
 */
export async function createJobPaymentSession(
  token: string,
  stage: 'deposit' | 'balance',
): Promise<{
  mode: 'stripe' | 'manual';
  url?: string;
  orderNumber: string;
  amountCents: number;
}> {
  const row = await db.studioJob.findUnique({ where: { shareToken: token.trim() } });
  if (!row) throw new Error('Proposal not found.');
  if (row.status === 'cancelled') throw new Error('This proposal has been cancelled.');

  if (stage === 'deposit') {
    if (row.depositPaidAt) throw new Error('Deposit has already been paid.');
    if (row.depositCents <= 0) throw new Error('No deposit amount is set on this proposal.');
  } else {
    if (!row.depositPaidAt && row.depositCents > 0) {
      throw new Error('Deposit must be paid before paying the final balance.');
    }
    if (row.balancePaidAt) throw new Error('Final balance has already been paid.');
    if (row.balanceCents <= 0) throw new Error('No balance remains on this job.');
  }

  const amountCents = stage === 'deposit' ? row.depositCents : row.balanceCents;
  const amountDollars = Math.round(amountCents) / 100;
  const stageLabel = stage === 'deposit' ? `Deposit (${row.depositPercent}%)` : 'Final Balance';
  const [brand, checkoutModeRaw] = await Promise.all([getEmailBrand(), getConfig('CHECKOUT_MODE')]);
  const mode: 'stripe' | 'manual' = checkoutModeRaw === 'manual' ? 'manual' : 'stripe';

  // Reuse an existing pending commission Order for this stage if present, or create a fresh one.
  const existingOrderId = stage === 'deposit' ? row.depositOrderId : row.balanceOrderId;
  let order = existingOrderId
    ? await db.order.findUnique({ where: { id: existingOrderId } })
    : null;

  if (!order || order.paymentStatus !== 'pending' || Math.round(order.total * 100) !== amountCents) {
    const orderNumber = `JOB-${stage === 'deposit' ? 'DEP' : 'BAL'}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    order = await db.order.create({
      data: {
        orderNumber,
        userEmail: row.clientEmail,
        status: 'pending',
        type: 'commission',
        subtotal: amountDollars,
        shipping: 0,
        tax: 0,
        total: amountDollars,
        currency: row.currency || 'USD',
        paymentStatus: 'pending',
        paymentMethod: mode === 'manual' ? 'manual' : 'stripe',
        specialInstructions: `${row.jobNumber} · ${stageLabel} · ${LICENSE_DEFINITIONS[normalizeLicenseType(row.licenseType)].label}`,
        items: {
          create: [
            {
              productId: `job:${row.id}:${stage}`,
              quantity: 1,
              unitPrice: amountDollars,
              totalPrice: amountDollars,
              productTitle: `${row.title} (${stageLabel})`,
              productImage: '',
              notes: row.jobNumber,
            },
          ],
        },
        timeline: {
          create: [
            {
              status: 'pending',
              message: `${stageLabel} checkout opened for ${row.jobNumber}`,
            },
          ],
        },
      },
    });

    await db.studioJob.update({
      where: { id: row.id },
      data: stage === 'deposit' ? { depositOrderId: order.id } : { balanceOrderId: order.id },
    });
  }

  if (mode === 'manual') {
    await createStudioThread({
      subject: `${stageLabel} requested: ${row.title} (${row.jobNumber})`,
      userEmail: row.clientEmail,
      userName: row.clientName,
      relatedOrderId: order.id,
      initialBody: `${row.clientName} accepted terms on ${row.jobNumber} and requested manual payment for ${stageLabel} (${formatCents(amountCents, row.currency)}). Order ${order.orderNumber}.`,
      senderRole: 'buyer',
      tags: ['commission'],
    }).catch(() => undefined);

    return {
      mode: 'manual',
      orderNumber: order.orderNumber,
      amountCents,
    };
  }

  const stripe = await getStripe();
  const proposalUrl = `${brand.siteUrl}/proposals/${encodeURIComponent(row.shareToken)}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: row.clientEmail,
    client_reference_id: order.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (row.currency || 'USD').toLowerCase(),
          unit_amount: amountCents,
          product_data: {
            name: `${row.title} (${stageLabel})`,
            description: `${row.jobNumber} · ${LICENSE_DEFINITIONS[normalizeLicenseType(row.licenseType)].label}`,
          },
        },
      },
    ],
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      jobId: row.id,
      jobPaymentStage: stage,
      customerEmail: row.clientEmail,
    },
    success_url: `${proposalUrl}?paid=${stage}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${proposalUrl}?cancelled=1`,
  });

  await db.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  return {
    mode: 'stripe',
    url: session.url,
    orderNumber: order.orderNumber,
    amountCents,
  };
}

/**
 * Called automatically when an Order transitions to `paid` (Stripe webhook, return-URL verification, or manual Mark Paid).
 * Idempotently advances the linked StudioJob, locks terms on deposit, and issues a COA on final payment.
 */
export async function finalizeJobPaymentForOrder(orderId: string): Promise<StudioJobRecord | null> {
  const job = await db.studioJob.findFirst({
    where: {
      OR: [{ depositOrderId: orderId }, { balanceOrderId: orderId }],
    },
  });
  if (!job) return null;

  const isDeposit = job.depositOrderId === orderId;
  const now = new Date();
  const timeline = parseTimeline(job.timeline);

  if (isDeposit) {
    if (job.depositPaidAt) return getJobById(job.id);

    const licenseType = normalizeLicenseType(job.licenseType);
    const snapshot: JobTermsSnapshot = {
      acceptedAt: now.toISOString(),
      clientEmail: job.clientEmail,
      scope: job.scope,
      medium: job.medium,
      dimensions: job.dimensions,
      totalCents: job.totalCents,
      depositPercent: job.depositPercent,
      depositCents: job.depositCents,
      balanceCents: job.balanceCents,
      currency: job.currency || 'USD',
      turnaroundDays: job.turnaroundDays,
      dueDate: job.dueDate ? job.dueDate.toISOString() : null,
      licenseType,
      licenseClause: LICENSE_DEFINITIONS[licenseType].termsClause,
      revisionCap: job.revisionCap,
      killFeePercent: job.killFeePercent,
    };

    const fullyPaidUpfront = job.balanceCents === 0;
    const nextStatus: JobStatus = fullyPaidUpfront ? 'final_paid' : 'deposit_paid';
    timeline.push(
      makeTimelineEntry({
        type: 'payment',
        status: nextStatus,
        message: fullyPaidUpfront
          ? `Terms accepted & full payment received (${formatCents(job.depositCents, job.currency)}).`
          : `Terms accepted & deposit paid (${formatCents(job.depositCents, job.currency)}). Terms are now locked.`,
        actor: 'client',
      }),
    );

    await db.studioJob.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        acceptedAt: now,
        depositPaidAt: now,
        ...(fullyPaidUpfront ? { balancePaidAt: now } : {}),
        termsSnapshot: snapshot as unknown as object,
        timeline: timeline as unknown as object,
      },
    });

    if (fullyPaidUpfront) {
      await issueCertificateForJob(job.id).catch(() => undefined);
    }

    return getJobById(job.id);
  }

  // Balance payment
  if (job.balancePaidAt) return getJobById(job.id);
  timeline.push(
    makeTimelineEntry({
      type: 'payment',
      status: 'final_paid',
      message: `Final balance paid (${formatCents(job.balanceCents, job.currency)}). Project complete.`,
      actor: 'client',
    }),
  );

  await db.studioJob.update({
    where: { id: job.id },
    data: {
      status: 'final_paid',
      balancePaidAt: now,
      timeline: timeline as unknown as object,
    },
  });

  await issueCertificateForJob(job.id).catch(() => undefined);
  return getJobById(job.id);
}

/** Artist marks a deposit or balance paid offline (cash, Venmo, Zelle, bank transfer). */
export async function markJobStagePaidManually(
  jobId: string,
  stage: 'deposit' | 'balance',
): Promise<StudioJobRecord> {
  const row = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!row) throw new Error('Job not found.');

  const amountCents = stage === 'deposit' ? row.depositCents : row.balanceCents;
  if (amountCents <= 0) throw new Error(`No ${stage} amount is set on this job.`);

  const amountDollars = Math.round(amountCents) / 100;
  const stageLabel = stage === 'deposit' ? `Deposit (${row.depositPercent}%)` : 'Final Balance';
  const existingOrderId = stage === 'deposit' ? row.depositOrderId : row.balanceOrderId;

  let orderId = existingOrderId;
  if (orderId) {
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: 'manual',
        status: stage === 'balance' ? 'delivered' : 'confirmed',
      },
    });
  } else {
    const order = await db.order.create({
      data: {
        orderNumber: `JOB-${stage === 'deposit' ? 'DEP' : 'BAL'}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
        userEmail: row.clientEmail,
        status: stage === 'balance' ? 'delivered' : 'confirmed',
        type: 'commission',
        subtotal: amountDollars,
        shipping: 0,
        tax: 0,
        total: amountDollars,
        currency: row.currency || 'USD',
        paymentStatus: 'paid',
        paymentMethod: 'manual',
        specialInstructions: `${row.jobNumber} · ${stageLabel} (recorded manually)`,
        items: {
          create: [
            {
              productId: `job:${row.id}:${stage}`,
              quantity: 1,
              unitPrice: amountDollars,
              totalPrice: amountDollars,
              productTitle: `${row.title} (${stageLabel})`,
              productImage: '',
              notes: row.jobNumber,
            },
          ],
        },
        timeline: {
          create: [
            {
              status: stage === 'balance' ? 'delivered' : 'confirmed',
              message: `${stageLabel} recorded manually by studio`,
            },
          ],
        },
      },
    });
    orderId = order.id;
    await db.studioJob.update({
      where: { id: row.id },
      data: stage === 'deposit' ? { depositOrderId: order.id } : { balanceOrderId: order.id },
    });
  }

  const updated = await finalizeJobPaymentForOrder(orderId);
  if (!updated) throw new Error('Failed to finalize job payment.');
  return updated;
}
