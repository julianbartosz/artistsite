import 'server-only';
import { db } from '@/lib/db';
import { getConfig, setConfig } from '@/lib/config';
import { sendTemplateEmail } from '@/lib/email';
import { getSiteContent } from '@/lib/site-content';
import { getAllPosts, getPrivatePostsForViewer } from '@/lib/markdown';
import { updatesPostPath } from '@/lib/site-content-shared';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function parseSegments(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function digestOptIn(preferences: Record<string, unknown>): boolean {
  if (preferences.digest === false) return false;
  if (preferences.newsletter === false) return false;
  return true;
}

export type DigestRunSummary = {
  skipped: boolean;
  reason?: string;
  publicSent: number;
  collectorSent: number;
};

export async function processUpdatesDigests(): Promise<DigestRunSummary> {
  const blog = await getSiteContent('blog');
  if (!blog.digestEnabled) {
    return { skipped: true, reason: 'disabled', publicSent: 0, collectorSent: 0 };
  }

  const intervalDays = Math.max(1, Math.min(30, blog.digestIntervalDays || 7));
  const lastRunRaw = await getConfig('UPDATES_DIGEST_LAST_RUN_AT');
  const now = Date.now();
  if (lastRunRaw) {
    const elapsed = now - new Date(lastRunRaw).getTime();
    if (elapsed < intervalDays * 24 * 60 * 60 * 1000) {
      return { skipped: true, reason: 'not_due', publicSent: 0, collectorSent: 0 };
    }
  }

  const since = lastRunRaw ? new Date(lastRunRaw) : new Date(now - intervalDays * 24 * 60 * 60 * 1000);
  const [identity, publicPosts] = await Promise.all([
    getSiteContent('identity'),
    getAllPosts(),
  ]);
  const recentPublic = publicPosts.filter((post) => new Date(post.publishedAt) >= since);
  const siteName = identity.siteName || 'Studio';
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

  let publicSent = 0;
  if (recentPublic.length > 0) {
    const profiles = await db.customerProfile.findMany({
      where: { segments: { contains: 'newsletter_subscriber' } },
      select: { email: true, preferences: true },
    });

    const listHtml = recentPublic.map((post) => {
      const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
      const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${updatesPostPath(post.slug)}` : updatesPostPath(post.slug);
      return `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></li>`;
    }).join('');

    for (const profile of profiles) {
      if (!profile.email) continue;
      const prefs = parseObject(profile.preferences);
      if (!digestOptIn(prefs)) continue;
      const delivered = await sendTemplateEmail(profile.email, {
        subject: blog.digestSubject || `${siteName}: recent updates`,
        html: `<p>${escapeHtml(blog.digestIntro || 'Here is what has been happening in the studio:')}</p><ul>${listHtml}</ul>`,
        text: `${blog.digestIntro || 'Recent studio updates:'}\n\n${recentPublic.map((post) => post.title).join('\n')}`,
      });
      if (delivered) publicSent += 1;
    }
  }

  let collectorSent = 0;
  if (blog.collectorDigestEnabled) {
    const privatePosts = await db.blogPost.findMany({
      where: {
        visibility: 'private',
        isDraft: false,
        publishedAt: { gte: since },
      },
      include: { audience: { select: { email: true, userId: true } } },
    });

    const postsByEmail = new Map<string, typeof privatePosts>();
    for (const post of privatePosts) {
      for (const entry of post.audience) {
        const email = entry.email.trim().toLowerCase();
        if (!email) continue;
        const list = postsByEmail.get(email) || [];
        list.push(post);
        postsByEmail.set(email, list);
      }
    }

    for (const [email, posts] of postsByEmail) {
      const listHtml = posts.map((post) => {
        const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
        const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${updatesPostPath(post.slug)}` : updatesPostPath(post.slug);
        return `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></li>`;
      }).join('');

      const delivered = await sendTemplateEmail(email, {
        subject: blog.collectorDigestSubject || `${siteName}: collector studio updates`,
        html: `<p>${escapeHtml(blog.collectorDigestIntro || 'New private studio notes shared with you:')}</p><ul>${listHtml}</ul>`,
        text: `${blog.collectorDigestIntro || 'Collector updates:'}\n\n${posts.map((post) => post.title).join('\n')}`,
      });
      if (delivered) collectorSent += 1;
    }
  }

  await setConfig('UPDATES_DIGEST_LAST_RUN_AT', new Date().toISOString(), { encrypt: false });
  return { skipped: false, publicSent, collectorSent };
}

export async function buildCollectorFeedPosts(userId: string, email: string) {
  return getPrivatePostsForViewer({ id: userId, email, isAdmin: false });
}
