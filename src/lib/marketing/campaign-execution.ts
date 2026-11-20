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