import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api-error-handler';
import { sanitizeNewsletterDocument } from '@/lib/admin-content';
import { getConfig, setConfigMany } from '@/lib/config';
import { getEmailBrand, getEmailDeliveryStatus, sendTemplateEmail } from '@/lib/email';
import { absoluteUrl, parseInternalPath } from '@/lib/utils';
import { publishSocialPost, type SocialPublishResult } from '@/lib/marketing/social-publishers';
import {
  AUTOMATION_EMAIL_CATALOG,
  AUTOMATION_EMAIL_IDS,
  buildDefaultAutomationDocument,
  getAutomationEmailDefinition,
  newsletterContentIssues,
  newsletterDocumentFromContent,
  newsletterDocumentSchema,
  newsletterMergeValues,
  newsletterSendIssues,
  personalizeNewsletter,
  renderNewsletter,
  type AutomationEmailId,
  type AutomationEmailSummary,
  type NewsletterDocument,
  type NewsletterMergeValues,
  type NewsletterRenderContext,
  type NewsletterSendContext,
  type NewsletterStatus,
  type NewsletterSummary,
  type RenderedNewsletter,
} from '@/lib/newsletter';
import {
  listNewsletterSubscribers,
  newsletterUnsubscribeHeaders,
  newsletterUnsubscribeLinks,
} from '@/lib/newsletter-subscribers';
type CampaignRecipient = {
  email: string;
  name?: string | null;
  customerProfileId?: string;
  userId?: string;
};

type CampaignSendResult = {
  campaignId: string;
  attempted: number;
  delivered: number;
  failed: number;
};

export type NewsletterMetrics = {
  total: number;
  delivered: number;
  failed: number;
  lastError?: string;
};

type NewsletterRecipient = { email: string; firstName?: string | null; profileId?: string };
type NewsletterSender = { fromName: string; replyTo?: string };

/** A send that stopped heartbeating this long ago is treated as interrupted and may be resumed. */
const SEND_STALE_MS = 15 * 60 * 1000;
const PROGRESS_INTERVAL = 20;

type CampaignProcessSummary = {
  attempted: number;
  completed: number;
  needsAttention: number;
  failed: number;
};

const dbWithMarketing = db as any;

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isEnabled(value: string | null | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function readNewsletterMetrics(value: unknown): NewsletterMetrics {
  const metrics = parseJsonObject(value);
  const count = (key: string) => {
    const parsed = Number(metrics[key] ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  };
  return {
    total: count('total'),
    delivered: count('delivered'),
    failed: count('failed'),
    ...(typeof metrics.lastError === 'string' && metrics.lastError ? { lastError: metrics.lastError } : {}),
  };
}

function serializePublishNote(result: SocialPublishResult): string {
  return JSON.stringify({
    at: new Date().toISOString(),
    mode: result.mode,
    status: result.status,
    externalId: result.externalId,
    error: result.error,
    assist: result.assist,
  });
}

function appendPublishNote(current: unknown, result: SocialPublishResult): string {
  const currentNotes = typeof current === 'string' ? current.trim() : '';
  return [currentNotes, serializePublishNote(result)].filter(Boolean).join('\n');
}

function eventActorKey(event: any): string | null {
  if (event.userId) return `user:${event.userId}`;
  if (event.sessionId) return `session:${event.sessionId}`;
  return null;
}

async function applySocialPublishResult(post: any, result: SocialPublishResult) {
  const campaign = await dbWithMarketing.socialMediaPost.update({
    where: { id: post.id },
    data: {
      status: result.status,
      postId: result.externalId || post.postId,
      publishedAt: result.publishedAt || post.publishedAt,
      notes: appendPublishNote(post.notes, result),
    },
  });

  await db.analyticsEvent.create({
    data: {
      eventName: 'social_publish_attempt',
      properties: JSON.stringify({
        campaign_id: post.id,
        platform: post.platform,
        mode: result.mode,
        status: result.status,
        external_id: result.externalId,
        error: result.error,
      }),
      timestamp: new Date(),
    },
  }).catch(() => undefined);

  return { ...campaign, publishAssist: result.assist, publishMode: result.mode, publishError: result.error };
}

// ---------------------------------------------------------------------------
// Newsletters
// ---------------------------------------------------------------------------

export async function getNewsletterRenderContext(): Promise<NewsletterRenderContext> {
  const [brand, footerAddress] = await Promise.all([
    getEmailBrand(),
    getConfig('NEWSLETTER_FOOTER_ADDRESS'),
  ]);
  return { ...brand, footerAddress: footerAddress || '' };
}

export async function getNewsletterSendContext(): Promise<NewsletterSendContext & { fromAddress: string; replyTo: string }> {
  const [context, delivery, subscribers, replyTo] = await Promise.all([
    getNewsletterRenderContext(),
    getEmailDeliveryStatus(),
    listNewsletterSubscribers(),
    newsletterReplyTo(),
  ]);
  return {
    ...context,
    subscriberCount: subscribers.length,
    deliveryMode: delivery.mode,
    fromAddress: delivery.fromAddress,
    replyTo: replyTo || '',
  };
}

async function newsletterReplyTo(): Promise<string | undefined> {
  return await getConfig('ARTIST_EMAIL') || await getConfig('CONTACT_EMAIL') || undefined;
}

async function newsletterSender(document: NewsletterDocument, context: NewsletterRenderContext): Promise<NewsletterSender> {
  return { fromName: document.fromName.trim() || context.siteName, replyTo: await newsletterReplyTo() };
}

function automationRenderContext(base: NewsletterRenderContext, automationId?: AutomationEmailId): NewsletterRenderContext {
  if (automationId === AUTOMATION_EMAIL_IDS.cartRecovery) {
    return {
      ...base,
      footerReason: `You are receiving this reminder because you began checking out at ${base.siteName}.`,
      includeUnsubscribe: false,
    };
  }
  return base;
}

async function deliverNewsletter(
  rendered: RenderedNewsletter,
  recipient: NewsletterRecipient,
  context: NewsletterRenderContext,
  sender: NewsletterSender,
  extraMergeValues?: Partial<Pick<NewsletterMergeValues, 'checkout_url' | 'promo_code'>>,
): Promise<boolean> {
  const includeUnsubscribe = context.includeUnsubscribe !== false;
  const links = includeUnsubscribe ? newsletterUnsubscribeLinks(recipient.email, context.siteUrl) : null;
  const personalized = personalizeNewsletter(
    rendered,
    newsletterMergeValues(recipient, context, links?.pageUrl ?? '#', extraMergeValues),
  );
  return sendTemplateEmail(recipient.email, personalized, {
    fromName: sender.fromName,
    replyTo: sender.replyTo,
    ...(links ? { headers: newsletterUnsubscribeHeaders(links.oneClickUrl) } : {}),
  });
}

/** Renders and sends one newsletter-styled email to each subscriber the caller passes in. */
export async function sendNewsletterEmails(
  document: NewsletterDocument,
  recipients: NewsletterRecipient[],
  onResult?: (recipient: NewsletterRecipient, ok: boolean) => Promise<void>,
  options?: {
    automationId?: AutomationEmailId;
    extraMergeValues?: (recipient: NewsletterRecipient) => Partial<Pick<NewsletterMergeValues, 'checkout_url' | 'promo_code'>>;
  },
): Promise<{ delivered: number; failed: number }> {
  const baseContext = await getNewsletterRenderContext();
  const context = automationRenderContext(baseContext, options?.automationId);
  const rendered = renderNewsletter(document, context);
  const sender = await newsletterSender(document, context);
  let delivered = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const ok = await deliverNewsletter(
      rendered,
      recipient,
      context,
      sender,
      options?.extraMergeValues?.(recipient),
    );
    if (ok) delivered += 1;
    else failed += 1;
    await onResult?.(recipient, ok);
  }
  return { delivered, failed };
}

export async function sendNewsletterTest(
  document: NewsletterDocument,
  emails: string[],
  options?: { automationId?: AutomationEmailId; promoCode?: string },
) {
  const [users, renderContext, configuredPromo] = await Promise.all([
    db.user.findMany({
      where: { email: { in: emails, mode: 'insensitive' } },
      select: { email: true, firstName: true, name: true },
    }),
    getNewsletterRenderContext(),
    options?.automationId === AUTOMATION_EMAIL_IDS.cartRecovery
      ? (options.promoCode !== undefined ? Promise.resolve(options.promoCode) : getConfig('CART_RECOVERY_PROMO_CODE'))
      : Promise.resolve(undefined),
  ]);
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const delivered: string[] = [];
  const failed: string[] = [];
  const isCartRecovery = options?.automationId === AUTOMATION_EMAIL_IDS.cartRecovery;
  await sendNewsletterEmails(
    { ...document, subject: `[Test] ${document.subject.trim()}` },
    emails.map((email) => {
      const user = usersByEmail.get(email);
      return { email, firstName: user?.firstName || user?.name?.trim().split(' ')[0] || null };
    }),
    async (recipient, ok) => {
      (ok ? delivered : failed).push(recipient.email);
    },
    isCartRecovery
      ? {
          automationId: AUTOMATION_EMAIL_IDS.cartRecovery,
          extraMergeValues: () => ({
            checkout_url: absoluteUrl('/checkout', renderContext.siteUrl),
            promo_code: configuredPromo?.trim() || 'STUDIO10',
          }),
        }
      : undefined,
  );
  return { delivered, failed };
}

/**
 * Validates and atomically moves a newsletter into `active`. Sent newsletters can only be
 * claimed again to retry recipients whose delivery failed.
 */
export async function claimEmailCampaign(campaignId: string): Promise<'send' | 'retry'> {
  const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ApiError(404, 'Newsletter not found', 'NOT_FOUND');

  const staleBefore = new Date(Date.now() - SEND_STALE_MS);
  const mode = campaign.sentAt ? 'retry' : 'send';
  if (mode === 'retry') {
    const failed = await db.emailCampaignDelivery.count({ where: { campaignId, status: 'failed' } });
    if (failed === 0) {
      await db.emailCampaign.updateMany({
        where: { id: campaignId, status: 'active', updatedAt: { lt: staleBefore } },
        data: { status: 'completed' },
      });
      throw new ApiError(409, 'This newsletter has already been sent.', 'ALREADY_SENT');
    }
  }

  const issues = newsletterSendIssues(newsletterDocumentFromContent(campaign.content), await getNewsletterSendContext());
  if (issues.length > 0) throw new ApiError(400, issues[0].message, 'NOT_READY', issues);

  const metrics = readNewsletterMetrics(campaign.metrics);
  const claimed = await db.emailCampaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        { status: { in: mode === 'retry' ? ['completed', 'paused'] : ['draft', 'scheduled', 'paused'] } },
        { status: 'active', updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: 'active',
      metrics: JSON.stringify({ total: metrics.total, delivered: metrics.delivered, failed: metrics.failed }),
    },
  });
  if (!claimed.count) throw new ApiError(409, 'This newsletter is already sending.', 'ALREADY_SENDING');
  return mode;
}

/**
 * Sends a claimed newsletter to current subscribers who have not received it. The delivery
 * ledger makes this safe to resume after an interruption and to re-run for failed recipients.
 */
export async function deliverEmailCampaign(campaignId: string, mode: 'send' | 'retry'): Promise<CampaignSendResult> {
  const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: campaignId } });
  try {
    const subscribers = await listNewsletterSubscribers();
    const subscribedEmails = subscribers.map((subscriber) => subscriber.email);
    await db.emailCampaignDelivery.updateMany({
      where: { campaignId, status: 'failed', email: { notIn: subscribedEmails } },
      data: { status: 'skipped', error: 'Unsubscribed before retry' },
    });

    const ledger = await db.emailCampaignDelivery.findMany({ where: { campaignId }, select: { email: true, status: true } });
    const sent = new Set(ledger.filter((entry) => entry.status === 'sent').map((entry) => entry.email));
    const failedBefore = new Set(ledger.filter((entry) => entry.status === 'failed').map((entry) => entry.email));
    const queue = subscribers.filter((subscriber) => (
      !sent.has(subscriber.email) && (mode === 'send' || failedBefore.has(subscriber.email))
    ));

    const total = sent.size + queue.length;
    let delivered = sent.size;
    let failed = 0;
    let processed = 0;
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: { metrics: JSON.stringify({ total, delivered, failed }) },
    });

    const result = await sendNewsletterEmails(
      newsletterDocumentFromContent(campaign.content),
      queue.map((subscriber) => ({ email: subscriber.email, firstName: subscriber.firstName, profileId: subscriber.profileId })),
      async (recipient, ok) => {
        if (ok) delivered += 1;
        else failed += 1;
        await db.emailCampaignDelivery.upsert({
          where: { campaignId_email: { campaignId, email: recipient.email } },
          create: { campaignId, email: recipient.email, status: ok ? 'sent' : 'failed', error: ok ? null : 'Delivery failed' },
          update: { status: ok ? 'sent' : 'failed', error: ok ? null : 'Delivery failed', attemptedAt: new Date() },
        });
        await db.analyticsEvent.create({
          data: {
            eventName: ok ? 'email_sent' : 'email_failed',
            userId: recipient.profileId,
            properties: JSON.stringify({
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              recipient_email: recipient.email,
              delivery_success: ok,
            }),
            timestamp: new Date(),
          },
        }).catch(() => undefined);
        processed += 1;
        if (processed % PROGRESS_INTERVAL === 0) {
          await db.emailCampaign.update({
            where: { id: campaignId },
            data: { metrics: JSON.stringify({ total, delivered, failed }) },
          });
        }
      },
    );

    const counts = await db.emailCampaignDelivery.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    const countFor = (status: string) => counts.find((entry) => entry.status === status)?._count._all ?? 0;
    const finalDelivered = countFor('sent');
    const finalFailed = countFor('failed');
    const metrics: NewsletterMetrics = {
      total: finalDelivered + finalFailed,
      delivered: finalDelivered,
      failed: finalFailed,
      ...(finalDelivered === 0
        ? {
          lastError: finalFailed > 0
            ? 'No emails could be delivered. Check Email delivery in Settings, then send again.'
            : 'There were no subscribers to send to.',
        }
        : {}),
    };
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: {
        metrics: JSON.stringify(metrics),
        status: finalDelivered > 0 ? 'completed' : 'paused',
        sentAt: finalDelivered > 0 ? campaign.sentAt ?? new Date() : campaign.sentAt,
      },
    });

    return { campaignId, attempted: queue.length, delivered: result.delivered, failed: result.failed };
  } catch (error) {
    await markCampaignNeedsAttention(campaignId, error instanceof Error ? error.message : 'Sending stopped unexpectedly');
    throw error;
  }
}

async function markCampaignNeedsAttention(campaignId: string, message: string): Promise<void> {
  const current = await db.emailCampaign.findUnique({ where: { id: campaignId }, select: { metrics: true, status: true } });
  if (!current || current.status === 'completed') return;
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'paused', metrics: JSON.stringify({ ...readNewsletterMetrics(current.metrics), lastError: message }) },
  }).catch(() => undefined);
}

const NEWSLETTER_STATUSES = new Set<NewsletterStatus>(['draft', 'scheduled', 'active', 'paused', 'completed']);

export async function listNewsletterSummaries(ids?: string[]): Promise<NewsletterSummary[]> {
  const campaigns = await db.emailCampaign.findMany({
    where: { type: 'broadcast', ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  const sentCounts = campaigns.length
    ? await db.emailCampaignDelivery.groupBy({
      by: ['campaignId'],
      where: { status: 'sent', campaignId: { in: campaigns.map((campaign) => campaign.id) } },
      _count: { _all: true },
    })
    : [];
  const sentByCampaign = new Map(sentCounts.map((entry) => [entry.campaignId, entry._count._all]));

  return campaigns.map((campaign) => {
    const status = NEWSLETTER_STATUSES.has(campaign.status as NewsletterStatus) ? campaign.status as NewsletterStatus : 'draft';
    return {
      id: campaign.id,
      status,
      document: newsletterDocumentFromContent(campaign.content),
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      updatedAt: campaign.updatedAt.toISOString(),
      metrics: readNewsletterMetrics(campaign.metrics),
      editable: status !== 'active' && status !== 'completed' && !sentByCampaign.get(campaign.id),
    };
  });
}

export async function getNewsletterSummary(id: string): Promise<NewsletterSummary> {
  const [summary] = await listNewsletterSummaries([id]);
  if (!summary) throw new ApiError(404, 'Newsletter not found', 'NOT_FOUND');
  return summary;
}

/** Sends due scheduled newsletters and resumes sends that were interrupted mid-run. */
export async function processDueEmailCampaigns(now = new Date()): Promise<CampaignSendResult[]> {
  const dueCampaigns = await db.emailCampaign.findMany({
    where: {
      type: 'broadcast',
      OR: [
        { status: 'scheduled', scheduledAt: { lte: now } },
        { status: 'active', updatedAt: { lt: new Date(now.getTime() - SEND_STALE_MS) } },
      ],
    },
    select: { id: true },
    take: 10,
  }).catch(() => []);

  const results: CampaignSendResult[] = [];
  for (const campaign of dueCampaigns) {
    try {
      results.push(await deliverEmailCampaign(campaign.id, await claimEmailCampaign(campaign.id)));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) continue;
      await markCampaignNeedsAttention(campaign.id, error instanceof Error ? error.message : 'Scheduled send failed');
    }
  }

  return results;
}

export async function processDueSocialPosts(now = new Date()): Promise<CampaignProcessSummary> {
  const duePosts = await dbWithMarketing.socialMediaPost.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
    take: 10,
  }).catch(() => []);

  const summary: CampaignProcessSummary = { attempted: 0, completed: 0, needsAttention: 0, failed: 0 };

  for (const post of duePosts) {
    const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : null;
    if (post.status !== 'scheduled' || (scheduledAt && scheduledAt > now)) continue;
    summary.attempted += 1;

    try {
      const result = await publishSocialPost(post);
      await applySocialPublishResult(post, result);
      if (result.status === 'published') summary.completed += 1;
      else if (result.status === 'needs_attention') summary.needsAttention += 1;
      else if (result.status === 'failed') summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      await dbWithMarketing.socialMediaPost.update({
        where: { id: post.id },
        data: { status: 'failed', notes: appendPublishNote(post.notes, { mode: 'assist', status: 'failed', error: error instanceof Error ? error.message : 'Social publish failed' }) },
      }).catch(() => undefined);
    }
  }

  return summary;
}

function normalizeEmailValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function extractSavedAutomationDocument(content: unknown): NewsletterDocument | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const parsed = newsletterDocumentSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const AUTOMATION_CAMPAIGN_IDS = AUTOMATION_EMAIL_IDS;

const WELCOME_FOLLOWUP_MIN_DAYS = 3;
const WELCOME_FOLLOWUP_MAX_DAYS = 30;
const DEFAULT_WINBACK_INACTIVE_DAYS = 45;
const AUTOMATION_BATCH_LIMIT = 50;

export function parseWinbackInactiveDays(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 14) return DEFAULT_WINBACK_INACTIVE_DAYS;
  return Math.min(365, parsed);
}

async function ensureAutomationCampaign(id: AutomationEmailId): Promise<void> {
  const def = getAutomationEmailDefinition(id);
  await db.emailCampaign.upsert({
    where: { id },
    create: {
      id,
      name: def.title,
      type: 'automated',
      templateId: def.templateId,
      segments: JSON.stringify([def.audienceKind === 'checkout' ? 'checkout_visitor' : 'newsletter_subscriber']),
      metrics: JSON.stringify({ total: 0, delivered: 0, failed: 0 }),
      status: 'active',
    },
    update: {},
  });
}

async function resolveAutomationDocument(
  id: AutomationEmailId,
  options: { siteName: string; promoCode?: string },
): Promise<NewsletterDocument> {
  const row = await db.emailCampaign.findUnique({
    where: { id },
    select: { content: true },
  }).catch(() => null);
  const saved = extractSavedAutomationDocument(row?.content);
  return saved ?? buildDefaultAutomationDocument(id, options);
}

async function recordAutomationDelivery(
  campaignId: string,
  email: string,
  ok: boolean,
  automationKey: string,
  profileId?: string | null,
): Promise<void> {
  const now = new Date();
  await db.emailCampaignDelivery.upsert({
    where: { campaignId_email: { campaignId, email } },
    create: {
      campaignId,
      email,
      status: ok ? 'sent' : 'failed',
      error: ok ? null : 'Delivery failed',
      attemptedAt: now,
    },
    update: {
      status: ok ? 'sent' : 'failed',
      error: ok ? null : 'Delivery failed',
      attemptedAt: now,
    },
  }).catch(() => undefined);

  await db.analyticsEvent.create({
    data: {
      eventName: ok ? 'email_sent' : 'email_failed',
      ...(profileId ? { userId: profileId } : {}),
      properties: JSON.stringify({
        automation: automationKey,
        campaign_id: campaignId,
        recipient_email: email,
        delivery_success: ok,
      }),
      timestamp: now,
    },
  }).catch(() => undefined);
}

export async function listAutomationEmailSummaries(): Promise<AutomationEmailSummary[]> {
  const ids = AUTOMATION_EMAIL_CATALOG.map((entry) => entry.id);
  const [
    brand,
    welcomeEnabled,
    welcomeSeriesEnabled,
    winbackEnabled,
    winbackDaysRaw,
    cartEnabled,
    cartPromoRaw,
    campaigns,
    deliveryStats,
  ] = await Promise.all([
    getEmailBrand(),
    getConfig('NEWSLETTER_WELCOME_ENABLED'),
    getConfig('NEWSLETTER_WELCOME_SERIES_ENABLED'),
    getConfig('WINBACK_EMAIL_ENABLED'),
    getConfig('WINBACK_INACTIVE_DAYS'),
    getConfig('CART_ABANDONMENT_ENABLED'),
    getConfig('CART_RECOVERY_PROMO_CODE'),
    db.emailCampaign.findMany({
      where: { id: { in: ids } },
      select: { id: true, content: true, updatedAt: true },
    }).catch(() => []),
    db.emailCampaignDelivery.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
      _max: { attemptedAt: true },
    }).catch(() => []),
  ]);

  const winbackDays = parseWinbackInactiveDays(winbackDaysRaw);
  const promoCode = (cartPromoRaw || '').trim();
  const enabledByKey: Record<string, boolean> = {
    NEWSLETTER_WELCOME_ENABLED: isEnabled(welcomeEnabled, true),
    NEWSLETTER_WELCOME_SERIES_ENABLED: isEnabled(welcomeSeriesEnabled, false),
    WINBACK_EMAIL_ENABLED: isEnabled(winbackEnabled, false),
    CART_ABANDONMENT_ENABLED: isEnabled(cartEnabled, false),
  };

  const campaignById = new Map(campaigns.map((row) => [row.id, row]));
  const metricsById = new Map<string, { delivered: number; failed: number; lastSentAt: string | null }>();
  for (const row of deliveryStats) {
    const entry = metricsById.get(row.campaignId) ?? { delivered: 0, failed: 0, lastSentAt: null };
    if (row.status === 'sent') {
      entry.delivered += row._count._all;
      if (row._max.attemptedAt) entry.lastSentAt = row._max.attemptedAt.toISOString();
    } else if (row.status === 'failed') {
      entry.failed += row._count._all;
    }
    metricsById.set(row.campaignId, entry);
  }

  return AUTOMATION_EMAIL_CATALOG.map((def) => {
    const row = campaignById.get(def.id);
    const saved = extractSavedAutomationDocument(row?.content);
    const defaultDocument = buildDefaultAutomationDocument(def.id, {
      siteName: brand.siteName,
      promoCode: def.id === AUTOMATION_EMAIL_IDS.cartRecovery ? promoCode : undefined,
    });
    const metrics = metricsById.get(def.id) ?? { delivered: 0, failed: 0, lastSentAt: null };
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      triggerSummary: def.id === AUTOMATION_EMAIL_IDS.collectorWinback
        ? `After ${winbackDays} quiet days`
        : def.triggerSummary,
      settingKey: def.settingKey,
      enabled: enabledByKey[def.settingKey] ?? def.defaultEnabled,
      requiresScheduler: def.requiresScheduler,
      audienceKind: def.audienceKind,
      customized: Boolean(saved),
      document: saved ?? defaultDocument,
      defaultDocument,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      metrics,
      ...(def.id === AUTOMATION_EMAIL_IDS.collectorWinback ? { winbackDays } : {}),
      ...(def.id === AUTOMATION_EMAIL_IDS.cartRecovery ? { cartRecoveryPromoCode: promoCode } : {}),
    };
  });
}

export async function getAutomationEmailSummary(id: AutomationEmailId): Promise<AutomationEmailSummary> {
  const list = await listAutomationEmailSummaries();
  const found = list.find((entry) => entry.id === id);
  if (!found) throw new ApiError(404, 'Automation email not found', 'NOT_FOUND');
  return found;
}

export async function saveAutomationEmail(
  id: AutomationEmailId,
  payload: {
    document?: NewsletterDocument;
    resetToDefault?: boolean;
    enabled?: boolean;
    winbackDays?: number;
    cartRecoveryPromoCode?: string;
  },
): Promise<AutomationEmailSummary> {
  const def = getAutomationEmailDefinition(id);
  const renderContext = await getNewsletterRenderContext();

  if (payload.document && !payload.resetToDefault) {
    const sanitized = sanitizeNewsletterDocument(payload.document);
    const issues = newsletterContentIssues(sanitized, { siteUrl: renderContext.siteUrl }, { audienceKind: def.audienceKind });
    if (issues.length > 0) throw new ApiError(400, issues[0].message, 'NOT_READY', issues);

    await ensureAutomationCampaign(id);
    await db.emailCampaign.update({
      where: { id },
      data: {
        name: def.title,
        templateId: def.templateId,
        content: sanitized as unknown as Prisma.InputJsonValue,
      },
    });
  } else if (payload.resetToDefault) {
    await ensureAutomationCampaign(id);
    await db.emailCampaign.update({
      where: { id },
      data: {
        name: def.title,
        templateId: def.templateId,
        content: Prisma.DbNull,
      },
    });
  }

  const settingUpdates: Array<{ key: string; value: string }> = [];
  if (typeof payload.enabled === 'boolean') {
    settingUpdates.push({ key: def.settingKey, value: payload.enabled ? 'true' : 'false' });
  }
  if (id === AUTOMATION_EMAIL_IDS.collectorWinback && typeof payload.winbackDays === 'number') {
    const clamped = Math.max(14, Math.min(365, Math.round(payload.winbackDays)));
    settingUpdates.push({ key: 'WINBACK_INACTIVE_DAYS', value: String(clamped) });
  }
  if (id === AUTOMATION_EMAIL_IDS.cartRecovery && typeof payload.cartRecoveryPromoCode === 'string') {
    settingUpdates.push({ key: 'CART_RECOVERY_PROMO_CODE', value: payload.cartRecoveryPromoCode.trim().slice(0, 64) });
  }
  if (settingUpdates.length > 0) {
    await setConfigMany(settingUpdates);
  }

  return getAutomationEmailSummary(id);
}

export async function processDueCartRecovery(now = new Date()): Promise<CampaignProcessSummary> {
  const [cartEnabled, delivery] = await Promise.all([
    getConfig('CART_ABANDONMENT_ENABLED'),
    getEmailDeliveryStatus(),
  ]);
  if (!isEnabled(cartEnabled, false) || delivery.mode !== 'smtp') {
    return { attempted: 0, completed: 0, needsAttention: 0, failed: 0 };
  }

  const staleBefore = new Date(now.getTime() - 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [events, recentOrders] = await Promise.all([
    db.analyticsEvent.findMany({
      where: {
        eventName: { in: ['add_to_cart', 'begin_checkout', 'purchase', 'cart_abandoned'] },
        timestamp: { gte: windowStart },
      },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    }).catch(() => []),
    db.order.findMany({
      where: {
        createdAt: { gte: windowStart },
        status: { notIn: ['cancelled', 'refunded'] },
      },
      select: { userEmail: true, userId: true },
    }).catch(() => []),
  ]);

  const completedActors = new Set<string>();
  const completedEmails = new Set<string>();
  const recoveredActors = new Set<string>();
  const recoveredEmails = new Set<string>();
  const cartSignals = [] as any[];

  for (const order of recentOrders) {
    if (order.userId) completedActors.add(`user:${order.userId}`);
    const orderEmail = normalizeEmailValue(order.userEmail);
    if (orderEmail) completedEmails.add(orderEmail);
  }

  for (const event of events) {
    const key = eventActorKey(event);
    const props = parseJsonObject(event.properties);
    const propEmail = normalizeEmailValue(props.recipient_email || props.email);
    if (event.eventName === 'purchase') {
      if (key) completedActors.add(key);
      if (propEmail) completedEmails.add(propEmail);
    }
    if (event.eventName === 'cart_abandoned') {
      if (key) recoveredActors.add(key);
      if (propEmail) recoveredEmails.add(propEmail);
    }
    if (
      (event.eventName === 'add_to_cart' || event.eventName === 'begin_checkout')
      && new Date(event.timestamp) <= staleBefore
    ) {
      cartSignals.push(event);
    }
  }

  const userIds = Array.from(new Set(cartSignals.map((event) => event.userId).filter(Boolean)));
  const [users, profiles] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, firstName: true, name: true } }).catch(() => []) : [],
    userIds.length ? dbWithMarketing.customerProfile.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }).catch(() => []) : [],
  ]);
  const recipientsById = new Map<string, CampaignRecipient>();
  for (const user of users as any[]) {
    if (user.email) recipientsById.set(user.id, { email: user.email, name: user.firstName || user.name, userId: user.id });
  }
  for (const profile of profiles as any[]) {
    if (profile.email && !recipientsById.has(profile.id)) {
      recipientsById.set(profile.id, { email: profile.email, customerProfileId: profile.id });
    }
  }

  const [brand, promoCodeRaw] = await Promise.all([getEmailBrand(), getConfig('CART_RECOVERY_PROMO_CODE')]);
  const promoCode = (promoCodeRaw || '').trim();
  const campaignId = AUTOMATION_CAMPAIGN_IDS.cartRecovery;
  await ensureAutomationCampaign(campaignId);
  const doc = await resolveAutomationDocument(campaignId, { siteName: brand.siteName, promoCode });

  const summary: CampaignProcessSummary = { attempted: 0, completed: 0, needsAttention: 0, failed: 0 };
  const processedActors = new Set<string>();
  const processedEmails = new Set<string>();

  for (const signal of cartSignals) {
    const key = eventActorKey(signal);
    const properties = parseJsonObject(signal.properties);
    const recipient: CampaignRecipient | undefined = typeof properties.email === 'string' && properties.email.trim()
      ? { email: properties.email.trim(), name: typeof properties.name === 'string' ? properties.name : null, userId: signal.userId }
      : signal.userId ? recipientsById.get(signal.userId) : undefined;
    const normalizedEmail = normalizeEmailValue(recipient?.email);
    if (!normalizedEmail) continue;
    if (
      (key && (completedActors.has(key) || recoveredActors.has(key) || processedActors.has(key)))
      || completedEmails.has(normalizedEmail)
      || recoveredEmails.has(normalizedEmail)
      || processedEmails.has(normalizedEmail)
    ) {
      continue;
    }

    if (key) processedActors.add(key);
    processedEmails.add(normalizedEmail);
    summary.attempted += 1;
    const requestedPath = typeof properties.recovery_path === 'string' ? parseInternalPath(properties.recovery_path.trim()) : null;
    const recoveryPath = requestedPath ? `${requestedPath.pathname}${requestedPath.search}` : '/checkout';
    const checkoutUrl = absoluteUrl(recoveryPath, brand.siteUrl);
    const firstName = recipient?.name?.trim().split(' ')[0] || null;

    const result = await sendNewsletterEmails(
      doc,
      [{ email: normalizedEmail, firstName, profileId: recipient?.customerProfileId ?? signal.userId ?? undefined }],
      undefined,
      {
        automationId: campaignId,
        extraMergeValues: () => ({
          checkout_url: checkoutUrl,
          promo_code: promoCode,
        }),
      },
    );
    const ok = result.delivered > 0;
    if (ok) summary.completed += 1;
    else summary.failed += 1;

    await recordAutomationDelivery(campaignId, normalizedEmail, ok, 'cart_recovery', signal.userId);
    await db.analyticsEvent.create({
      data: {
        eventName: 'cart_abandoned',
        userId: signal.userId,
        sessionId: signal.sessionId,
        properties: JSON.stringify({
          cart_event_id: signal.id,
          campaign_id: campaignId,
          recipient_email: normalizedEmail,
          delivery_success: ok,
          promo_code: promoCode || undefined,
        }),
        timestamp: now,
      },
    }).catch(() => undefined);
  }

  return summary;
}

/**
 * Sends the immediate welcome/confirmation email when a visitor joins the newsletter.
 * Uses the DB delivery ledger (`EmailCampaignDelivery`) so retries/re-subscribes never double-send,
 * and returns `delivered: true` ONLY when real SMTP delivery succeeded.
 */
export async function sendNewsletterWelcomeEmail(
  email: string,
  profileId?: string | null,
): Promise<{ attempted: boolean; delivered: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { attempted: false, delivered: false };

  if (!isEnabled(await getConfig('NEWSLETTER_WELCOME_ENABLED'), true)) {
    return { attempted: false, delivered: false };
  }

  const delivery = await getEmailDeliveryStatus();
  if (delivery.mode !== 'smtp') {
    return { attempted: false, delivered: false };
  }

  const campaignId = AUTOMATION_CAMPAIGN_IDS.newsletterWelcome;
  await ensureAutomationCampaign(campaignId);

  const alreadySent = await db.emailCampaignDelivery.findUnique({
    where: { campaignId_email: { campaignId, email: normalizedEmail } },
    select: { status: true },
  }).catch(() => null);
  if (alreadySent?.status === 'sent') {
    return { attempted: false, delivered: false };
  }

  const [brand, user] = await Promise.all([
    getEmailBrand(),
    db.user.findUnique({
      where: { email: normalizedEmail },
      select: { firstName: true, name: true },
    }).catch(() => null),
  ]);
  const firstName = user?.firstName?.trim() || user?.name?.trim().split(' ')[0] || null;

  const doc = await resolveAutomationDocument(campaignId, { siteName: brand.siteName });
  const result = await sendNewsletterEmails(doc, [{
    email: normalizedEmail,
    firstName,
    profileId: profileId ?? undefined,
  }]);
  const ok = result.delivered > 0;
  await recordAutomationDelivery(campaignId, normalizedEmail, ok, 'newsletter_welcome', profileId);
  return { attempted: true, delivered: ok };
}

/**
 * Runs built-in in-site subscriber automations (Welcome Series Step 2 + Quiet Collector Win-Back)
 * using Resend SMTP and the idempotent `EmailCampaignDelivery` ledger.
 */
export async function processDueSubscriberAutomations(now = new Date()): Promise<{
  welcomeFollowup: CampaignProcessSummary;
  winback: CampaignProcessSummary;
}> {
  const empty = (): CampaignProcessSummary => ({ attempted: 0, completed: 0, needsAttention: 0, failed: 0 });
  const welcomeFollowup = empty();
  const winback = empty();

  const [welcomeSeriesEnabled, winbackEnabled, winbackDaysRaw, delivery] = await Promise.all([
    getConfig('NEWSLETTER_WELCOME_SERIES_ENABLED'),
    getConfig('WINBACK_EMAIL_ENABLED'),
    getConfig('WINBACK_INACTIVE_DAYS'),
    getEmailDeliveryStatus(),
  ]);

  const runFollowup = isEnabled(welcomeSeriesEnabled, false);
  const runWinback = isEnabled(winbackEnabled, false);
  if ((!runFollowup && !runWinback) || delivery.mode !== 'smtp') {
    return { welcomeFollowup, winback };
  }

  const [subscribers, brand] = await Promise.all([listNewsletterSubscribers(), getEmailBrand()]);
  if (subscribers.length === 0) return { welcomeFollowup, winback };

  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (runFollowup) {
    const campaignId = AUTOMATION_CAMPAIGN_IDS.newsletterWelcomeFollowup;
    await ensureAutomationCampaign(campaignId);
    const sentRows = await db.emailCampaignDelivery.findMany({
      where: { campaignId, status: 'sent' },
      select: { email: true },
    }).catch(() => []);
    const alreadySent = new Set(sentRows.map((row) => row.email.toLowerCase()));

    const eligible = subscribers
      .filter((subscriber) => {
        if (alreadySent.has(subscriber.email)) return false;
        const ageMs = nowMs - new Date(subscriber.subscribedAt).getTime();
        return ageMs >= WELCOME_FOLLOWUP_MIN_DAYS * dayMs && ageMs <= WELCOME_FOLLOWUP_MAX_DAYS * dayMs;
      })
      .slice(0, AUTOMATION_BATCH_LIMIT);

    if (eligible.length > 0) {
      const doc = await resolveAutomationDocument(campaignId, { siteName: brand.siteName });
      await sendNewsletterEmails(
        doc,
        eligible.map((s) => ({ email: s.email, firstName: s.firstName, profileId: s.profileId })),
        async (recipient, ok) => {
          welcomeFollowup.attempted += 1;
          if (ok) welcomeFollowup.completed += 1;
          else welcomeFollowup.failed += 1;
          await recordAutomationDelivery(campaignId, recipient.email, ok, 'newsletter_welcome_followup', recipient.profileId);
        },
      );
    }
  }

  if (runWinback) {
    const inactiveDays = parseWinbackInactiveDays(winbackDaysRaw);
    const cutoff = new Date(nowMs - inactiveDays * dayMs);
    const campaignId = AUTOMATION_CAMPAIGN_IDS.collectorWinback;
    await ensureAutomationCampaign(campaignId);

    const [sentRows, profiles, recentOrders] = await Promise.all([
      db.emailCampaignDelivery.findMany({
        where: { campaignId, status: 'sent' },
        select: { email: true },
      }).catch(() => []),
      db.customerProfile.findMany({
        where: { id: { in: subscribers.map((s) => s.profileId) } },
        select: { id: true, lastActivity: true },
      }).catch(() => []),
      db.order.findMany({
        where: {
          createdAt: { gte: cutoff },
          status: { notIn: ['cancelled', 'refunded'] },
        },
        select: { userEmail: true },
      }).catch(() => []),
    ]);

    const alreadySent = new Set(sentRows.map((row) => row.email.toLowerCase()));
    const activityByProfile = new Map(profiles.map((p) => [p.id, p.lastActivity]));
    const recentBuyerEmails = new Set(
      recentOrders
        .map((order) => order.userEmail?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );

    const eligible = subscribers
      .filter((subscriber) => {
        if (alreadySent.has(subscriber.email)) return false;
        if (recentBuyerEmails.has(subscriber.email)) return false;
        const subscribedAt = new Date(subscriber.subscribedAt);
        if (subscribedAt > cutoff) return false;
        const lastActivity = activityByProfile.get(subscriber.profileId) ?? subscribedAt;
        return lastActivity <= cutoff;
      })
      .slice(0, AUTOMATION_BATCH_LIMIT);

    if (eligible.length > 0) {
      const doc = await resolveAutomationDocument(campaignId, { siteName: brand.siteName });
      await sendNewsletterEmails(
        doc,
        eligible.map((s) => ({ email: s.email, firstName: s.firstName, profileId: s.profileId })),
        async (recipient, ok) => {
          winback.attempted += 1;
          if (ok) winback.completed += 1;
          else winback.failed += 1;
          await recordAutomationDelivery(campaignId, recipient.email, ok, 'collector_winback', recipient.profileId);
        },
      );
    }
  }

  return { welcomeFollowup, winback };
}

export async function publishRecordedCampaign(kind: 'social' | 'ad', id: string) {
  if (kind === 'social') {
    const post = await dbWithMarketing.socialMediaPost.findUnique({ where: { id } });
    if (!post) throw new Error('Social post not found');

    const result = await publishSocialPost(post);
    return applySocialPublishResult(post, result);
  }

  return dbWithMarketing.adCampaign.update({
    where: { id },
    data: { status: 'active' },
  });
}