export type CommissionAvailabilityStatus = 'open' | 'waitlist' | 'closed';

export type LicenseType = 'personal' | 'commercial' | 'exclusive';

export type JobCategory = 'portrait' | 'mural' | 'merch' | 'event' | 'custom';

export type JobStatus =
  | 'inquiry'
  | 'quoted'
  | 'deposit_paid'
  | 'awaiting_approval'
  | 'in_progress'
  | 'delivered'
  | 'final_paid'
  | 'on_hold'
  | 'cancelled';

export interface LicenseDefinition {
  key: LicenseType;
  label: string;
  shortLabel: string;
  multiplier: number;
  summary: string;
  termsClause: string;
}

export const LICENSE_DEFINITIONS: Record<LicenseType, LicenseDefinition> = {
  personal: {
    key: 'personal',
    label: 'Personal Display',
    shortLabel: 'Personal',
    multiplier: 1,
    summary: 'Private display and non-commercial personal enjoyment. Artist retains reproduction rights.',
    termsClause:
      'Personal Display License: Buyer receives the physical artwork or final file for private, non-commercial display. The artist retains copyright and reproduction rights.',
  },
  commercial: {
    key: 'commercial',
    label: 'Commercial License',
    shortLabel: 'Commercial',
    multiplier: 1.5,
    summary: 'Approved commercial use (merchandise, packaging, brand media) within agreed scope. Artist retains portfolio rights.',
    termsClause:
      'Commercial Usage License: Client is granted non-exclusive commercial rights to reproduce and publish the final artwork for the agreed project scope. The artist retains portfolio display rights.',
  },
  exclusive: {
    key: 'exclusive',
    label: 'Exclusive Buyout',
    shortLabel: 'Exclusive',
    multiplier: 2.25,
    summary: 'Exclusive commercial rights to the final artwork. Artist will not license the work to others.',
    termsClause:
      'Exclusive Commercial Rights: Client receives exclusive worldwide rights to use and reproduce the final artwork. The artist will not resell or license the artwork to third parties and retains portfolio credit rights.',
  },
};

export const LICENSE_OPTIONS: readonly LicenseDefinition[] = [
  LICENSE_DEFINITIONS.personal,
  LICENSE_DEFINITIONS.commercial,
  LICENSE_DEFINITIONS.exclusive,
];

export const JOB_STATUSES: readonly JobStatus[] = [
  'inquiry',
  'quoted',
  'deposit_paid',
  'awaiting_approval',
  'in_progress',
  'delivered',
  'final_paid',
  'on_hold',
  'cancelled',
];

export const JOB_PIPELINE_STEPS: ReadonlyArray<{ status: JobStatus; label: string; shortLabel: string }> = [
  { status: 'inquiry', label: 'Inquiry', shortLabel: 'Inquiry' },
  { status: 'quoted', label: 'Quoted', shortLabel: 'Quoted' },
  { status: 'deposit_paid', label: 'Deposit paid', shortLabel: 'Deposit' },
  { status: 'awaiting_approval', label: 'Proof review', shortLabel: 'Proof' },
  { status: 'in_progress', label: 'In progress', shortLabel: 'Working' },
  { status: 'delivered', label: 'Delivered', shortLabel: 'Delivered' },
  { status: 'final_paid', label: 'Final paid', shortLabel: 'Paid' },
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  deposit_paid: 'Deposit paid',
  awaiting_approval: 'Awaiting approval',
  in_progress: 'In progress',
  delivered: 'Delivered',
  final_paid: 'Final paid',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

export interface JobTemplate {
  id: JobCategory;
  name: string;
  defaultTitle: string;
  defaultScope: string;
  defaultMedium: string;
  depositPercent: number;
  turnaroundDays: number;
  licenseType: LicenseType;
  revisionCap: number;
  killFeePercent: number;
}

export const DEFAULT_JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    id: 'portrait',
    name: 'Custom Portrait',
    defaultTitle: 'Custom Commission Portrait',
    defaultScope:
      'Original custom piece created from client references. Includes initial composition sketch for approval prior to final painting.',
    defaultMedium: 'Watercolor & ink on archival cotton paper',
    depositPercent: 50,
    turnaroundDays: 21,
    licenseType: 'personal',
    revisionCap: 2,
    killFeePercent: 25,
  },
  {
    id: 'mural',
    name: 'Mural / Wall Installation',
    defaultTitle: 'Site-Specific Mural Commission',
    defaultScope:
      'Concept sketch, color study, surface prep coordination, and on-site mural execution. Client provides clear wall access and lighting.',
    defaultMedium: 'Exterior/interior acrylic mural paint',
    depositPercent: 50,
    turnaroundDays: 30,
    licenseType: 'commercial',
    revisionCap: 2,
    killFeePercent: 30,
  },
  {
    id: 'merch',
    name: 'Merch / Brand Illustration',
    defaultTitle: 'Custom Illustration for Merchandise',
    defaultScope:
      'Original illustration delivered as print-ready high-resolution files (PNG/PDF/TIFF) sized for apparel, packaging, or posters.',
    defaultMedium: 'Hand-drawn illustration digitized for print',
    depositPercent: 50,
    turnaroundDays: 14,
    licenseType: 'commercial',
    revisionCap: 2,
    killFeePercent: 25,
  },
  {
    id: 'event',
    name: 'Event / Editorial Artwork',
    defaultTitle: 'Custom Event Poster & Collateral',
    defaultScope:
      'Hero illustration and print-ready layout assets for event poster, flyers, and social announcements.',
    defaultMedium: 'Mixed media illustration + print layout',
    depositPercent: 50,
    turnaroundDays: 14,
    licenseType: 'commercial',
    revisionCap: 2,
    killFeePercent: 25,
  },
];

export interface JobTimelineEntry {
  id: string;
  type: 'status' | 'proposal' | 'payment' | 'proof' | 'approval' | 'note';
  status?: JobStatus;
  message: string;
  imageUrl?: string;
  createdAt: string;
  actor?: 'artist' | 'client' | 'system';
}

export interface JobTermsSnapshot {
  acceptedAt: string;
  clientEmail: string;
  scope: string;
  medium: string | null;
  dimensions: string | null;
  totalCents: number;
  depositPercent: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  turnaroundDays: number;
  dueDate: string | null;
  licenseType: LicenseType;
  licenseClause: string;
  revisionCap: number;
  killFeePercent: number;
}

export interface StudioJobRecord {
  id: string;
  jobNumber: string;
  shareToken: string;
  title: string;
  category: JobCategory;
  status: JobStatus;
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
  dueDate: string | null;
  licenseType: LicenseType;
  revisionCap: number;
  killFeePercent: number;
  termsSnapshot: JobTermsSnapshot | null;
  acceptedAt: string | null;
  depositOrderId: string | null;
  balanceOrderId: string | null;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  notes: string | null;
  timeline: JobTimelineEntry[];
  certificateCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRecord {
  id: string;
  code: string;
  orderId: string | null;
  jobId: string | null;
  productId: string | null;
  artworkTitle: string;
  artistName: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  editionInfo: string | null;
  licenseType: LicenseType;
  collectorName: string | null;
  artworkImage: string | null;
  issuedAt: string;
  revokedAt: string | null;
}

export type ConsignmentStatus = 'out' | 'sold' | 'returned';

export interface ConsignmentRecord {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  venueName: string;
  contactName: string | null;
  contactEmail: string | null;
  quantity: number;
  askingPrice: number;
  artistSplitPercent: number;
  artistPayout: number;
  status: ConsignmentStatus;
  placedAt: string;
  returnDueAt: string | null;
  closedAt: string | null;
  reminderSentAt: string | null;
  notes: string | null;
}

export function normalizeCommissionStatus(raw: string | null | undefined): CommissionAvailabilityStatus {
  const cleaned = String(raw ?? '').trim().toLowerCase();
  if (cleaned === 'waitlist' || cleaned === 'closed' || cleaned === 'open') {
    return cleaned;
  }
  return 'open';
}

export function normalizeLicenseType(raw: unknown, fallback: LicenseType = 'personal'): LicenseType {
  if (raw === 'personal' || raw === 'commercial' || raw === 'exclusive') return raw;
  return fallback;
}

export function normalizeJobStatus(raw: unknown, fallback: JobStatus = 'inquiry'): JobStatus {
  if (typeof raw === 'string' && (JOB_STATUSES as readonly string[]).includes(raw)) {
    return raw as JobStatus;
  }
  return fallback;
}

export function normalizeJobCategory(raw: unknown): JobCategory {
  if (raw === 'portrait' || raw === 'mural' || raw === 'merch' || raw === 'event' || raw === 'custom') {
    return raw;
  }
  return 'custom';
}

export function normalizeJobTemplates(raw: unknown): JobTemplate[] {
  const map = new Map<JobCategory, JobTemplate>(
    DEFAULT_JOB_TEMPLATES.map((tpl) => [tpl.id, { ...tpl }]),
  );
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Partial<JobTemplate>;
      const id = normalizeJobCategory(item.id);
      const base = map.get(id);
      if (!base) continue;
      map.set(id, {
        id,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 60) : base.name,
        defaultTitle:
          typeof item.defaultTitle === 'string' && item.defaultTitle.trim()
            ? item.defaultTitle.trim().slice(0, 120)
            : base.defaultTitle,
        defaultScope:
          typeof item.defaultScope === 'string' && item.defaultScope.trim()
            ? item.defaultScope.trim().slice(0, 2000)
            : base.defaultScope,
        defaultMedium:
          typeof item.defaultMedium === 'string'
            ? item.defaultMedium.trim().slice(0, 160)
            : base.defaultMedium,
        depositPercent: clampInt(item.depositPercent, 0, 100, base.depositPercent),
        turnaroundDays: clampInt(item.turnaroundDays, 1, 365, base.turnaroundDays),
        licenseType: normalizeLicenseType(item.licenseType, base.licenseType),
        revisionCap: clampInt(item.revisionCap, 0, 20, base.revisionCap),
        killFeePercent: clampInt(item.killFeePercent, 0, 100, base.killFeePercent),
      });
    }
  }
  return Array.from(map.values());
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/** Exact integer-cent split guaranteeing depositCents + balanceCents === totalCents. */
export function computeDepositAndBalance(
  totalCents: number,
  depositPercent: number,
): { totalCents: number; depositPercent: number; depositCents: number; balanceCents: number } {
  const safeTotal = Math.max(0, Math.round(Number.isFinite(totalCents) ? totalCents : 0));
  const safePercent = clampInt(depositPercent, 0, 100, 50);
  const depositCents = Math.round((safeTotal * safePercent) / 100);
  const balanceCents = Math.max(0, safeTotal - depositCents);
  return { totalCents: safeTotal, depositPercent: safePercent, depositCents, balanceCents };
}

export interface JobPricingInput {
  hours: number;
  hourlyRate: number;
  materials: number;
  rushPercent: number;
  licenseType: LicenseType;
  depositPercent: number;
}

export interface JobPricingResult {
  laborCents: number;
  materialsCents: number;
  baseCents: number;
  rushCents: number;
  licenseMultiplier: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
}

/** Studio-only pricing helper: (hours * rate + materials) * (1 + rush%) * licenseMultiplier, rounded to nearest $5. */
export function computeJobPricing(input: JobPricingInput): JobPricingResult {
  const hours = Math.max(0, Number.isFinite(input.hours) ? input.hours : 0);
  const hourlyRate = Math.max(0, Number.isFinite(input.hourlyRate) ? input.hourlyRate : 0);
  const materials = Math.max(0, Number.isFinite(input.materials) ? input.materials : 0);
  const rushPercent = Math.max(0, Math.min(200, Number.isFinite(input.rushPercent) ? input.rushPercent : 0));
  const licenseDef = LICENSE_DEFINITIONS[normalizeLicenseType(input.licenseType)];

  const laborCents = Math.round(hours * hourlyRate * 100);
  const materialsCents = Math.round(materials * 100);
  const baseCents = laborCents + materialsCents;
  const rushCents = Math.round((baseCents * rushPercent) / 100);
  const rawTotalCents = Math.round((baseCents + rushCents) * licenseDef.multiplier);
  // Round to nearest $5 (500 cents) when >= $25 for clean client quotes; otherwise nearest $1.
  const roundingUnit = rawTotalCents >= 2500 ? 500 : 100;
  const totalCents = Math.round(rawTotalCents / roundingUnit) * roundingUnit;
  const split = computeDepositAndBalance(totalCents, input.depositPercent);

  return {
    laborCents,
    materialsCents,
    baseCents,
    rushCents,
    licenseMultiplier: licenseDef.multiplier,
    totalCents: split.totalCents,
    depositCents: split.depositCents,
    balanceCents: split.balanceCents,
  };
}

/**
 * Computes a quoted completion date from startDate + turnaroundDays.
 * If the studio has a blackout window (vacation / art fair week) overlapping
 * the production span, shifts the due date by the exact overlap days.
 */
export function computeQuotedDueDate(
  startDate: Date,
  turnaroundDays: number,
  blackoutStartIso?: string | null,
  blackoutEndIso?: string | null,
): Date {
  const dayMs = 24 * 60 * 60 * 1000;
  const safeDays = clampInt(turnaroundDays, 1, 365, 21);
  const startUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  let endUtc = startUtc + safeDays * dayMs;

  if (blackoutStartIso && blackoutEndIso) {
    const bStart = Date.parse(`${blackoutStartIso.slice(0, 10)}T00:00:00Z`);
    const bEnd = Date.parse(`${blackoutEndIso.slice(0, 10)}T00:00:00Z`);
    if (Number.isFinite(bStart) && Number.isFinite(bEnd) && bEnd >= bStart) {
      const overlapStart = Math.max(startUtc, bStart);
      const overlapEnd = Math.min(endUtc, bEnd + dayMs);
      if (overlapEnd > overlapStart) {
        const overlapDays = Math.ceil((overlapEnd - overlapStart) / dayMs);
        endUtc += overlapDays * dayMs;
      }
    }
  }

  return new Date(endUtc);
}

export function formatCents(cents: number, currency: string = 'USD'): string {
  const safe = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(safe);
}

export function jobStatusTone(status: JobStatus): string {
  switch (status) {
    case 'final_paid':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'delivered':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'deposit_paid':
    case 'in_progress':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'awaiting_approval':
    case 'quoted':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'on_hold':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function isJobTermsLocked(job: Pick<StudioJobRecord, 'acceptedAt' | 'depositPaidAt'>): boolean {
  return Boolean(job.acceptedAt || job.depositPaidAt);
}
