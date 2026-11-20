import 'server-only';
import { db } from '@/lib/db';
import { getConfig, setConfig } from '@/lib/config';
import { brandedEmailHtml, getEmailBrand, sendTemplateEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/utils';
import { getPublishedSiteContent } from '@/lib/site-content';
import { getAllPosts, getPrivatePostsForViewer } from '@/lib/markdown';
import { updatesPostPath } from '@/lib/site-content-shared';
import { escapeHtml } from '@/lib/email-shell';
import { listNewsletterSubscribers } from '@/lib/newsletter-subscribers';
import { sendNewsletterEmails } from '@/lib/marketing/campaign-execution';

export type DigestRunSummary = {
  skipped: boolean;
  reason?: string;
  publicSent: number;
  collectorSent: number;
};

export async function processUpdatesDigests(): Promise<DigestRunSummary> {
  const blog = await getPublishedSiteContent('blog');
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
  const [brand, publicPosts] = await Promise.all([getEmailBrand(), getAllPosts()]);
  const recentPublic = publicPosts.filter((post) => new Date(post.publishedAt) >= since);
  const { siteName } = brand;
  const postListHtml = (posts: Array<{ format: string; excerpt?: string | null; title: string; slug: string }>) => `<ul>${posts.map((post) => {
    const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
    return `<li><a href="${escapeHtml(absoluteUrl(updatesPostPath(post.slug), brand.siteUrl))}">${escapeHtml(title)}</a></li>`;
  }).join('')}</ul>`;

  let publicSent = 0;
  if (recentPublic.length > 0) {
    const subscribers = (await listNewsletterSubscribers()).filter((subscriber) => subscriber.digest);

    const result = await sendNewsletterEmails(
      {
        subject: blog.digestSubject || `${siteName}: recent updates`,
        preheader: '',
        fromName: '',
        blocks: [{
          id: 'updates-digest',
          type: 'text',
          html: `<p>${escapeHtml(blog.digestIntro || 'Here is what has been happening in the studio:')}</p>${postListHtml(recentPublic)}`,
        }],
      },
      subscribers.map((subscriber) => ({ email: subscriber.email, firstName: subscriber.firstName, profileId: subscriber.profileId })),
    );
    publicSent = result.delivered;
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
      const delivered = await sendTemplateEmail(email, {
        subject: blog.collectorDigestSubject || `${siteName}: collector studio updates`,
        html: brandedEmailHtml(brand, {
          title: blog.privateSectionTitle || 'For collectors',
          intro: escapeHtml(blog.collectorDigestIntro || 'New private studio notes shared with you:'),
          sections: [{ html: postListHtml(posts) }],
        }),
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
