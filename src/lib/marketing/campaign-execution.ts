import 'server-only';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { brandedEmailHtml, getEmailBrand, getEmailDeliveryStatus, sendTemplateEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/email-shell';
import { absoluteUrl, parseInternalPath } from '@/lib/utils';
import { publishSocialPost, type SocialPublishResult } from '@/lib/marketing/social-publishers';
import {
  newsletterDocumentFromContent,
  newsletterMergeValues,
  newsletterSendIssues,
  personalizeNewsletter,
  renderNewsletter,
  type NewsletterDocument,
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

function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
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

async function deliverNewsletter(
  rendered: RenderedNewsletter,
  recipient: NewsletterRecipient,
  context: NewsletterRenderContext,
  sender: NewsletterSender,
): Promise<boolean> {
  const links = newsletterUnsubscribeLinks(recipient.email, context.siteUrl);
  const personalized = personalizeNewsletter(rendered, newsletterMergeValues(recipient, context, links.pageUrl));
  return sendTemplateEmail(recipient.email, personalized, {
    fromName: sender.fromName,
    replyTo: sender.replyTo,
    headers: newsletterUnsubscribeHeaders(links.oneClickUrl),
  });
}

/** Renders and sends one newsletter-styled email to each subscriber the caller passes in. */
export async function sendNewsletterEmails(
  document: NewsletterDocument,
  recipients: NewsletterRecipient[],
  onResult?: (recipient: NewsletterRecipient, ok: boolean) => Promise<void>,
): Promise<{ delivered: number; failed: number }> {
  const context = await getNewsletterRenderContext();
  const rendered = renderNewsletter(document, context);
  const sender = await newsletterSender(document, context);
  let delivered = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const ok = await deliverNewsletter(rendered, recipient, context, sender);
    if (ok) delivered += 1;
    else failed += 1;
    await onResult?.(recipient, ok);
  }
  return { delivered, failed };
}

export async function sendNewsletterTest(document: NewsletterDocument, emails: string[]) {
  const users = await db.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { email: true, firstName: true, name: true },
  });
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const delivered: string[] = [];
  const failed: string[] = [];
  await sendNewsletterEmails(
    { ...document, subject: `[Test] ${document.subject.trim()}` },
    emails.map((email) => {
      const user = usersByEmail.get(email);
      return { email, firstName: user?.firstName || user?.name?.trim().split(' ')[0] || null };
    }),
    async (recipient, ok) => {
      (ok ? delivered : failed).push(recipient.email);
    },
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

export async function processDueCartRecovery(now = new Date()): Promise<CampaignProcessSummary> {
  if (!isEnabled(await getConfig('CART_ABANDONMENT_ENABLED'), false)) {
    return { attempted: 0, completed: 0, needsAttention: 0, failed: 0 };
  }

  const staleBefore = new Date(now.getTime() - 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const events = await db.analyticsEvent.findMany({
    where: {
      eventName: { in: ['add_to_cart', 'begin_checkout', 'purchase', 'cart_abandoned'] },
      timestamp: { gte: windowStart },
    },
    orderBy: { timestamp: 'desc' },
    take: 1000,
  }).catch(() => []);

  const completedActors = new Set<string>();
  const recoveredActors = new Set<string>();
  const cartSignals = [] as any[];

  for (const event of events) {
    const key = eventActorKey(event);
    if (!key) continue;
    if (event.eventName === 'purchase') completedActors.add(key);
    if (event.eventName === 'cart_abandoned') recoveredActors.add(key);
    if (
      (event.eventName === 'add_to_cart' || event.eventName === 'begin_checkout')
      && new Date(event.timestamp) <= staleBefore
    ) {
      cartSignals.push(event);
    }
  }

  const userIds = Array.from(new Set(cartSignals.map((event) => event.userId).filter(Boolean)));
  const [users, profiles] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }).catch(() => []) : [],
    userIds.length ? dbWithMarketing.customerProfile.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }).catch(() => []) : [],
  ]);
  const recipientsById = new Map<string, CampaignRecipient>();
  for (const user of users as any[]) if (user.email) recipientsById.set(user.id, { email: user.email, name: user.name, userId: user.id });
  for (const profile of profiles as any[]) if (profile.email && !recipientsById.has(profile.id)) recipientsById.set(profile.id, { email: profile.email, customerProfileId: profile.id });

  const [brand, promoCode] = await Promise.all([getEmailBrand(), getConfig('CART_RECOVERY_PROMO_CODE')]);
  const summary: CampaignProcessSummary = { attempted: 0, completed: 0, needsAttention: 0, failed: 0 };
  const processedActors = new Set<string>();

  for (const signal of cartSignals) {
    const key = eventActorKey(signal);
    if (!key || completedActors.has(key) || recoveredActors.has(key) || processedActors.has(key)) continue;
    const properties = parseJsonObject(signal.properties);
    const recipient = typeof properties.email === 'string'
      ? { email: properties.email, name: typeof properties.name === 'string' ? properties.name : null, userId: signal.userId }
      : signal.userId ? recipientsById.get(signal.userId) : undefined;
    if (!recipient?.email) continue;

    processedActors.add(key);
    summary.attempted += 1;
    const requestedPath = typeof properties.recovery_path === 'string' ? parseInternalPath(properties.recovery_path.trim()) : null;
    const recoveryPath = requestedPath ? `${requestedPath.pathname}${requestedPath.search}` : '/checkout';
    const checkoutUrl = absoluteUrl(recoveryPath, brand.siteUrl);
    const template = {
      subject: 'Complete your artwork selection',
      html: brandedEmailHtml(brand, {
        title: 'Your artwork is still waiting',
        intro: `Hi ${escapeHtml(recipient.name || 'there')}, you recently selected artwork but did not finish checkout.`,
        sections: promoCode ? [{ html: `Use code <strong>${escapeHtml(promoCode)}</strong> when you return.` }] : [],
        cta: { label: 'Return to checkout', href: checkoutUrl },
      }),
      text: `Hi ${recipient.name || 'there'}, you recently selected artwork but did not finish checkout.${promoCode ? ` Use code ${promoCode} when you return.` : ''} Return to checkout: ${checkoutUrl}`,
    };
    const ok = await sendTemplateEmail(recipient.email, template);
    if (ok) summary.completed += 1;
    else summary.failed += 1;

    await db.analyticsEvent.create({
      data: {
        eventName: 'cart_abandoned',
        userId: signal.userId,
        sessionId: signal.sessionId,
        properties: JSON.stringify({
          cart_event_id: signal.id,
          recipient_email: recipient.email,
          delivery_success: ok,
          promo_code: promoCode || undefined,
        }),
        timestamp: now,
      },
    }).catch(() => undefined);
  }

  return summary;
}

export const AUTOMATION_CAMPAIGN_IDS = {
  newsletterWelcome: 'auto-newsletter-welcome',
  newsletterWelcomeFollowup: 'auto-newsletter-welcome-followup',
  collectorWinback: 'auto-collector-winback',
} as const;

const WELCOME_FOLLOWUP_MIN_DAYS = 3;
const WELCOME_FOLLOWUP_MAX_DAYS = 30;
const DEFAULT_WINBACK_INACTIVE_DAYS = 45;
const AUTOMATION_BATCH_LIMIT = 50;

export function parseWinbackInactiveDays(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 14) return DEFAULT_WINBACK_INACTIVE_DAYS;
  return Math.min(365, parsed);
}

async function ensureAutomationCampaign(
  id: string,
  name: string,
  templateId: string,
): Promise<void> {
  await db.emailCampaign.upsert({
    where: { id },
    create: {
      id,
      name,
      type: 'automated',
      templateId,
      segments: JSON.stringify(['newsletter_subscriber']),
      metrics: JSON.stringify({ total: 0, delivered: 0, failed: 0 }),
      status: 'active',
    },
    update: {},
  });
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

function buildNewsletterWelcomeDocument(siteName: string, siteUrl: string): NewsletterDocument {
  const portfolioUrl = absoluteUrl('/portfolio', siteUrl);
  const shopUrl = absoluteUrl('/shop', siteUrl);
  return {
    subject: `Welcome to ${siteName}`,
    preheader: 'You are on the studio list for new artwork, prints, and studio notes.',
    fromName: siteName,
    blocks: [
      {
        id: 'welcome-body',
        type: 'text',
        html: '<h2>Welcome to the studio list</h2><p>Hi {{first_name}},</p><p>Thank you for joining the list. You will hear directly from the studio when new originals, limited prints, exhibitions, and quiet studio notes arrive — never spam, and you can unsubscribe anytime below.</p>',
      },
      {
        id: 'welcome-cta',
        type: 'button',
        label: 'Explore the shop',
        href: shopUrl,
      },
      {
        id: 'welcome-portfolio',
        type: 'text',
        html: `<p>Or browse recent work in the <a href="${escapeHtml(portfolioUrl)}">portfolio</a>.</p>`,
      },
    ],
  };
}

function buildWelcomeFollowupDocument(siteName: string, siteUrl: string): NewsletterDocument {
  const portfolioUrl = absoluteUrl('/portfolio', siteUrl);
  const updatesUrl = absoluteUrl('/updates', siteUrl);
  const contactUrl = absoluteUrl('/contact', siteUrl);
  return {
    subject: `Inside the studio — ${siteName}`,
    preheader: 'A quick look at recent pieces, works in progress, and custom commissions.',
    fromName: siteName,
    blocks: [
      {
        id: 'followup-body',
        type: 'text',
        html: `<h2>A closer look inside the studio</h2><p>Hi {{first_name}},</p><p>Thanks again for following along. If you have not had a chance yet, you can browse <a href="${escapeHtml(portfolioUrl)}">recent portfolio pieces</a>, read <a href="${escapeHtml(updatesUrl)}">studio updates</a>, or reply directly to this email anytime with questions about framing, prints, or commissions.</p>`,
      },
      {
        id: 'followup-cta',
        type: 'button',
        label: 'Browse the portfolio',
        href: portfolioUrl,
      },
      {
        id: 'followup-contact',
        type: 'text',
        html: `<p>Looking for something specific? <a href="${escapeHtml(contactUrl)}">Send a note to the studio</a>.</p>`,
      },
    ],
  };
}

function buildCollectorWinbackDocument(siteName: string, siteUrl: string): NewsletterDocument {
  const shopUrl = absoluteUrl('/shop', siteUrl);
  const updatesUrl = absoluteUrl('/updates', siteUrl);
  return {
    subject: `Fresh from the studio — ${siteName}`,
    preheader: 'New artwork and studio notes waiting whenever you want a look.',
    fromName: siteName,
    blocks: [
      {
        id: 'winback-body',
        type: 'text',
        html: `<h2>A quiet note from the studio</h2><p>Hi {{first_name}},</p><p>It has been a little while since we last crossed paths. Whenever you feel like taking a slow look, there are fresh pieces in the shop and recent notes over in <a href="${escapeHtml(updatesUrl)}">Studio Updates</a>.</p>`,
      },
      {
        id: 'winback-cta',
        type: 'button',
        label: 'See what is new',
        href: shopUrl,
      },
    ],
  };
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
  await ensureAutomationCampaign(campaignId, 'Newsletter welcome', 'automated-welcome');

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

  const doc = buildNewsletterWelcomeDocument(brand.siteName, brand.siteUrl);
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
    await ensureAutomationCampaign(campaignId, 'Welcome series follow-up', 'automated-welcome-followup');
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
      const doc = buildWelcomeFollowupDocument(brand.siteName, brand.siteUrl);
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
    await ensureAutomationCampaign(campaignId, 'Collector win-back', 'automated-winback');

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
      const doc = buildCollectorWinbackDocument(brand.siteName, brand.siteUrl);
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