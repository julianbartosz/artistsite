import { brandedEmailHtml, getEmailBrand, sendTemplateEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/utils';
import { escapeHtml } from '@/lib/email-shell';
import { db } from '@/lib/db';
import { getPublishedSiteContent } from '@/lib/site-content';
import { updatesPostPath } from '@/lib/site-content-shared';

export async function notifyCollectorsOfPrivatePost(postId: string): Promise<number> {
  const post = await db.blogPost.findUnique({
    where: { id: postId },
    include: { audience: { select: { email: true } } },
  });

  if (!post || post.isDraft || post.visibility !== 'private') return 0;

  const emails = [...new Set(post.audience.map((entry) => entry.email.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return 0;

  const [blog, brand] = await Promise.all([
    getPublishedSiteContent('blog'),
    getEmailBrand(),
  ]);

  const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
  const fullUrl = absoluteUrl(updatesPostPath(post.slug), brand.siteUrl);
  const sectionTitle = blog.privateSectionTitle || 'For collectors';
  const template = {
    subject: `${brand.siteName}: new collector update: ${title}`,
    html: brandedEmailHtml(brand, {
      title: 'A new studio update for you',
      intro: `<strong>${escapeHtml(title)}</strong>`,
      cta: { label: `View in ${sectionTitle}`, href: fullUrl },
    }),
    text: `A new collector update is available: ${title}\n\nView: ${fullUrl}`,
  };

  let sent = 0;
  for (const email of emails) {
    if (await sendTemplateEmail(email, template)) sent += 1;
  }

  return sent;
}
