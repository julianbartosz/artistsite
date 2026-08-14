import 'server-only';
import { db } from '@/lib/db';
import { CustomerInsights } from '@/lib/analytics/customer-insights';
import { getConfig } from '@/lib/config';
import { sendTemplateEmail } from '@/lib/email';
import { publishSocialPost, type SocialPublishResult } from '@/lib/marketing/social-publishers';

type CampaignContent = {
  subject?: string;
  html?: string;
  text?: string;
};

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

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function mergeMetrics(current: unknown, delivered: number, failed: number) {
  const metrics = parseJsonObject(current);
  const sent = Number(metrics.sent || 0) + delivered + failed;
  const deliveredTotal = Number(metrics.delivered || 0) + delivered;
  const bounced = Number(metrics.bounced || 0) + failed;
  const opened = Number(metrics.opened || 0);
  const clicked = Number(metrics.clicked || 0);
  const converted = Number(metrics.converted || 0);

  return {
    ...metrics,
    sent,
    delivered: deliveredTotal,
    bounced,
    opened,
    clicked,
    converted,
    open_rate: sent > 0 ? (opened / sent) * 100 : 0,
    click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
    conversion_rate: sent > 0 ? (converted / sent) * 100 : 0,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceToken(content: string, token: string, value: string): string {
  return content.split(`{{${token}}}`).join(value);
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

async function renderContent(content: CampaignContent, recipient: CampaignRecipient) {
  const siteUrl = await getConfig('NEXT_PUBLIC_SITE_URL') || await getConfig('NEXT_PUBLIC_BASE_URL') || '';
  const values = {
    customer_name: escapeHtml(recipient.name || 'there'),
    email: escapeHtml(recipient.email),
    site_url: escapeHtml(siteUrl),
  };

  let subject = content.subject || 'Update from the studio';
  let html = content.html || '<p></p>';
  let text = content.text || subject;

  for (const [token, value] of Object.entries(values)) {
    subject = replaceToken(subject, token, value);
    html = replaceToken(html, token, value);
    text = replaceToken(text, token, value);
  }

  return { subject, html, text };
}

async function getAllRecipients(): Promise<CampaignRecipient[]> {
  const [users, profiles] = await Promise.all([
    db.user.findMany({
      where: { email: { not: '' } },
      select: { id: true, email: true, name: true, firstName: true, lastName: true },
      take: 1000,
    }),
    dbWithMarketing.customerProfile.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true },
      take: 1000,
    }).catch(() => []),
  ]);

  return [
    ...users.map((user: any) => ({
      email: user.email,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
      userId: user.id,
    })),
    ...profiles.map((profile: any) => ({
      email: profile.email,
      customerProfileId: profile.id,
    })),
  ];
}

async function getSegmentRecipients(segments: string[]): Promise<CampaignRecipient[]> {
  if (segments.length === 0 || segments.includes('all')) return getAllRecipients();

  const segmentRecipients = await Promise.all(
    segments.map(async (segment) => {
      try {
        const customers = await CustomerInsights.getSegmentCustomers(segment, 1000);
        return customers.map((customer: any) => ({
          email: customer.email,
          customerProfileId: customer.id,
        }));
      } catch {
        return [];
      }
    })
  );

  return segmentRecipients.flat();
}

function dedupeRecipients(recipients: CampaignRecipient[]): CampaignRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const email = recipient.email?.trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

export async function sendEmailCampaign(campaignId: string): Promise<CampaignSendResult> {
  const campaign = await dbWithMarketing.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'completed') throw new Error('Campaign has already been completed');

  const claimed = await dbWithMarketing.emailCampaign.updateMany({
    where: { id: campaign.id, status: { not: 'completed' } },
    data: { status: 'active' },
  });
  if (!claimed.count) throw new Error('Campaign is already being processed');

  const content = parseJsonObject(campaign.content) as CampaignContent;
  if (!content.subject || (!content.html && !content.text)) {
    throw new Error('Campaign content is incomplete');
  }

  const recipients = dedupeRecipients(await getSegmentRecipients(parseStringArray(campaign.segments)));
  let delivered = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const rendered = await renderContent(content, recipient);
    const ok = await sendTemplateEmail(recipient.email, rendered);
    if (ok) delivered += 1;
    else failed += 1;

    await db.analyticsEvent.create({
      data: {
        eventName: ok ? 'email_sent' : 'email_failed',
        userId: recipient.customerProfileId,
        properties: JSON.stringify({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          recipient_email: recipient.email,
          user_id: recipient.userId,
          delivery_success: ok,
        }),
        timestamp: new Date(),
      },
    }).catch(() => undefined);
  }

  const metrics = mergeMetrics(campaign.metrics, delivered, failed);
  await dbWithMarketing.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      metrics: JSON.stringify(metrics),
      status: failed > 0 && delivered === 0 ? 'paused' : 'completed',
    },
  });

  return { campaignId: campaign.id, attempted: recipients.length, delivered, failed };
}

export async function processDueEmailCampaigns(now = new Date()): Promise<CampaignSendResult[]> {
  const dueCampaigns = await dbWithMarketing.emailCampaign.findMany({
    where: {
      type: 'broadcast',
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
    take: 10,
  }).catch(() => []);

  const results: CampaignSendResult[] = [];
  for (const campaign of dueCampaigns) {
    try {
      results.push(await sendEmailCampaign(campaign.id));
    } catch (error) {
      await dbWithMarketing.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'paused' },
      }).catch(() => undefined);
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
    if (event.eventName === 'begin_checkout' || event.eventName === 'purchase') completedActors.add(key);
    if (event.eventName === 'cart_abandoned') recoveredActors.add(key);
    if (event.eventName === 'add_to_cart' && new Date(event.timestamp) <= staleBefore) cartSignals.push(event);
  }

  const userIds = Array.from(new Set(cartSignals.map((event) => event.userId).filter(Boolean)));
  const [users, profiles] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }).catch(() => []) : [],
    userIds.length ? dbWithMarketing.customerProfile.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }).catch(() => []) : [],
  ]);
  const recipientsById = new Map<string, CampaignRecipient>();
  for (const user of users as any[]) if (user.email) recipientsById.set(user.id, { email: user.email, name: user.name, userId: user.id });
  for (const profile of profiles as any[]) if (profile.email && !recipientsById.has(profile.id)) recipientsById.set(profile.id, { email: profile.email, customerProfileId: profile.id });

  const siteUrl = await getConfig('NEXT_PUBLIC_SITE_URL') || await getConfig('NEXT_PUBLIC_BASE_URL') || '';
  const promoCode = await getConfig('CART_RECOVERY_PROMO_CODE');
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
    const checkoutUrl = siteUrl ? `${siteUrl}/checkout` : '/checkout';
    const template = {
      subject: 'Complete your artwork selection',
      html: `<p>Hi ${escapeHtml(recipient.name || 'there')},</p><p>You recently selected artwork but did not finish checkout.</p>${promoCode ? `<p>Use code <strong>${escapeHtml(promoCode)}</strong> when you return.</p>` : ''}<p><a href="${escapeHtml(checkoutUrl)}">Return to checkout</a></p>`,
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