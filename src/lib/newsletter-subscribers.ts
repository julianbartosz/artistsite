import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { NEWSLETTER_SEGMENT } from '@/lib/newsletter';

export type NewsletterSubscriber = {
  profileId: string;
  email: string;
  firstName: string | null;
  name: string | null;
  subscribedAt: string;
  digest: boolean;
};

function parseSegments(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((segment): segment is string => typeof segment === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((segment): segment is string => typeof segment === 'string') : [];
  } catch {
    return [];
  }
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeSubscriberEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1 || email.length > 254 || email.includes(' ')) return null;
  return email;
}

function isSubscribedProfile(profile: { segments: unknown; preferences: unknown }): boolean {
  return parseSegments(profile.segments).includes(NEWSLETTER_SEGMENT)
    && parseObject(profile.preferences).newsletter !== false;
}

export const COMMISSION_WAITLIST_SEGMENT = 'commission_waitlist';

export function marketEventSegment(eventSlug: string): string {
  const clean = eventSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return clean ? `market:${clean}` : '';
}

export async function recordNewsletterSubscriber(
  email: string,
  digest = true,
  options?: { eventSlug?: string | null; firstName?: string | null; extraSegments?: string[] },
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const existing = await db.customerProfile.findUnique({ where: { email: normalizedEmail } }).catch(() => null);
  const existingSegments = parseSegments(existing?.segments);
  const existingPreferences = parseObject(existing?.preferences);
  const alreadySubscribed = existing ? isSubscribedProfile(existing) : false;
  const eventSeg = options?.eventSlug ? marketEventSegment(options.eventSlug) : '';
  const extraSegs = (options?.extraSegments ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9:_-]{2,64}$/.test(s));
  const segments = Array.from(
    new Set([...existingSegments, NEWSLETTER_SEGMENT, ...(eventSeg ? [eventSeg] : []), ...extraSegs]),
  );
  const subscribedAt = alreadySubscribed && typeof existingPreferences.subscribedAt === 'string'
    ? existingPreferences.subscribedAt
    : new Date().toISOString();
  const cleanFirstName = options?.firstName?.trim().slice(0, 60) || undefined;
  const nextPreferences = {
    ...existingPreferences,
    newsletter: true,
    digest,
    subscribedAt,
    ...(cleanFirstName ? { firstName: cleanFirstName } : {}),
    ...(eventSeg ? { lastMarketEvent: eventSeg.slice('market:'.length) } : {}),
  };

  const saved = await db.customerProfile.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      segments: JSON.stringify(segments),
      preferences: JSON.stringify(nextPreferences),
      lastActivity: new Date(),
    },
    update: {
      segments: JSON.stringify(segments),
      preferences: JSON.stringify(nextPreferences),
      lastActivity: new Date(),
    },
    select: { id: true },
  }).catch((error) => {
    console.error('Failed to record newsletter subscriber profile:', error);
    return null;
  });
  return saved?.id ?? existing?.id ?? null;
}

/** Tag a collector/visitor profile with a market event without altering newsletter opt-out state. */
export async function tagProfileWithMarketEvent(
  email: string,
  eventSlug: string,
  options?: { subscribeNewsletter?: boolean; firstName?: string | null },
): Promise<string | null> {
  const normalizedEmail = normalizeSubscriberEmail(email);
  const seg = marketEventSegment(eventSlug);
  if (!normalizedEmail || !seg) return null;

  if (options?.subscribeNewsletter) {
    return recordNewsletterSubscriber(normalizedEmail, true, { eventSlug, firstName: options.firstName });
  }

  const existing = await db.customerProfile.findUnique({ where: { email: normalizedEmail } }).catch(() => null);
  const existingSegments = parseSegments(existing?.segments);
  const existingPreferences = parseObject(existing?.preferences);
  const segments = Array.from(new Set([...existingSegments, seg]));
  const cleanFirstName = options?.firstName?.trim().slice(0, 60) || undefined;
  const preferences = {
    ...existingPreferences,
    ...(cleanFirstName && !existingPreferences.firstName ? { firstName: cleanFirstName } : {}),
    lastMarketEvent: seg.slice('market:'.length),
  };

  const saved = await db.customerProfile.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      segments: JSON.stringify(segments),
      preferences: JSON.stringify(preferences),
      lastActivity: new Date(),
    },
    update: {
      segments: JSON.stringify(segments),
      preferences: JSON.stringify(preferences),
      lastActivity: new Date(),
    },
    select: { id: true },
  }).catch(() => null);
  return saved?.id ?? existing?.id ?? null;
}

/** List contacts tagged with a market event who have not explicitly unsubscribed. */
export async function listMarketEventContacts(eventSlug: string): Promise<Array<{
  profileId: string;
  email: string;
  firstName: string | null;
}>> {
  const seg = marketEventSegment(eventSlug);
  if (!seg) return [];

  const profiles = await db.customerProfile.findMany({
    where: { email: { not: null } },
    orderBy: { lastActivity: 'desc' },
  });

  const matched = profiles.filter((profile) => {
    if (!profile.email) return false;
    const segments = parseSegments(profile.segments);
    const prefs = parseObject(profile.preferences);
    if (prefs.newsletter === false) return false;
    return segments.includes(seg);
  });

  if (matched.length === 0) return [];
  const emails = matched.map((p) => p.email!.toLowerCase());
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, firstName: true, name: true },
  }).catch(() => []);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  return matched.map((profile) => {
    const email = profile.email!.toLowerCase();
    const prefs = parseObject(profile.preferences);
    const user = userByEmail.get(email);
    const firstName =
      (typeof prefs.firstName === 'string' && prefs.firstName.trim()) ||
      user?.firstName?.trim() ||
      user?.name?.trim().split(/\s+/)[0] ||
      null;
    return { profileId: profile.id, email, firstName };
  });
}

/** Returns true when the address was subscribed before this call. */
export async function unsubscribeNewsletterEmail(email: string): Promise<boolean> {
  const normalizedEmail = normalizeSubscriberEmail(email);
  if (!normalizedEmail) return false;
  const profile = await db.customerProfile.findUnique({ where: { email: normalizedEmail } });
  const wasSubscribed = profile ? isSubscribedProfile(profile) : false;

  if (profile) {
    await db.customerProfile.update({
      where: { id: profile.id },
      data: {
        segments: JSON.stringify(parseSegments(profile.segments).filter((segment) => segment !== NEWSLETTER_SEGMENT)),
        preferences: JSON.stringify({
          ...parseObject(profile.preferences),
          newsletter: false,
          digest: false,
          unsubscribedAt: new Date().toISOString(),
        }),
      },
    });
  }

  await syncMailchimpUnsubscribe(normalizedEmail);
  return wasSubscribed;
}

export async function isNewsletterSubscriber(email: string): Promise<boolean> {
  const normalizedEmail = normalizeSubscriberEmail(email);
  if (!normalizedEmail) return false;
  const profile = await db.customerProfile.findUnique({ where: { email: normalizedEmail } });
  return profile ? isSubscribedProfile(profile) : false;
}

/** Opted-in subscribers, newest first, with names from matching accounts for personalization. */
export async function listNewsletterSubscribers(query = ''): Promise<NewsletterSubscriber[]> {
  const search = query.trim().toLowerCase();
  const profiles = await db.customerProfile.findMany({
    where: {
      segments: { contains: NEWSLETTER_SEGMENT },
      email: search ? { contains: search, mode: 'insensitive' } : { not: null },
    },
    select: { id: true, email: true, segments: true, preferences: true, createdAt: true },
  });
  const subscribed = profiles.filter((profile) => profile.email && isSubscribedProfile(profile));
  const users = subscribed.length
    ? await db.user.findMany({
      where: { email: { in: subscribed.map((profile) => profile.email as string), mode: 'insensitive' } },
      select: { email: true, firstName: true, name: true },
    })
    : [];
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  return subscribed
    .map((profile) => {
      const email = (profile.email as string).toLowerCase();
      const user = usersByEmail.get(email);
      const preferences = parseObject(profile.preferences);
      const firstName = user?.firstName?.trim() || user?.name?.trim().split(' ')[0] || null;
      return {
        profileId: profile.id,
        email,
        firstName,
        name: user?.name?.trim() || null,
        subscribedAt: typeof preferences.subscribedAt === 'string' ? preferences.subscribedAt : profile.createdAt.toISOString(),
        digest: preferences.digest !== false,
      };
    })
    .sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt));
}

export async function countNewsletterSubscribers(): Promise<number> {
  return (await listNewsletterSubscribers()).length;
}

// ---------------------------------------------------------------------------
// Unsubscribe links (never expire; bound to one purpose and one address)
// ---------------------------------------------------------------------------

const TOKEN_PURPOSE = 'newsletter-unsubscribe:';

function tokenSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

function signTokenBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${TOKEN_PURPOSE}${body}`).digest('base64url');
}

export function createUnsubscribeToken(email: string): string {
  const secret = tokenSecret();
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for unsubscribe links');
  const body = Buffer.from(email.trim().toLowerCase()).toString('base64url');
  return `${body}.${signTokenBody(body, secret)}`;
}

export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  const secret = tokenSecret();
  if (!secret || !token) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signTokenBody(body, secret));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  return normalizeSubscriberEmail(Buffer.from(body, 'base64url').toString('utf8'));
}

export const COLLECTOR_PROFILE_COOKIE = 'me_collector_profile';
const PROFILE_TOKEN_PURPOSE = 'collector-profile:';

function signPurposeBody(purpose: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${purpose}${body}`).digest('base64url');
}

export function createCollectorProfileToken(profileId: string): string | null {
  const secret = tokenSecret();
  const normalized = profileId.trim();
  if (!secret || !normalized) return null;
  const body = Buffer.from(normalized).toString('base64url');
  return `${body}.${signPurposeBody(PROFILE_TOKEN_PURPOSE, body, secret)}`;
}

export function verifyCollectorProfileToken(token: string | null | undefined): string | null {
  const secret = tokenSecret();
  if (!secret || !token) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signPurposeBody(PROFILE_TOKEN_PURPOSE, body, secret));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  const decoded = Buffer.from(body, 'base64url').toString('utf8').trim();
  return decoded || null;
}

export function newsletterUnsubscribeLinks(email: string, siteUrl: string): { pageUrl: string; oneClickUrl: string } {
  const token = encodeURIComponent(createUnsubscribeToken(email));
  const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  return {
    pageUrl: `${base}/unsubscribe?token=${token}`,
    oneClickUrl: `${base}/api/newsletter/unsubscribe?token=${token}`,
  };
}

/** RFC 8058 one-click unsubscribe headers required by major inbox providers for bulk mail. */
export function newsletterUnsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

async function syncMailchimpUnsubscribe(email: string): Promise<void> {
  if (await getConfig('NEWSLETTER_DELIVERY_MODE') !== 'mailchimp') return;
  const [apiKey, listId, serverPrefix] = await Promise.all([
    getConfig('MAILCHIMP_API_KEY'),
    getConfig('MAILCHIMP_LIST_ID'),
    getConfig('MAILCHIMP_SERVER_PREFIX'),
  ]);
  if (!apiKey || !listId || !serverPrefix) return;

  const memberHash = createHash('md5').update(email).digest('hex');
  try {
    const response = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${memberHash}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'unsubscribed' }),
    });
    if (!response.ok && response.status !== 404) {
      console.error('Mailchimp unsubscribe sync failed:', response.status);
    }
  } catch (error) {
    console.error('Mailchimp unsubscribe sync failed:', error);
  }
}
