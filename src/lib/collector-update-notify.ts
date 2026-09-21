import { sendTemplateEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { getSiteContent } from '@/lib/site-content';
import { updatesPostPath } from '@/lib/site-content-shared';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function notifyCollectorsOfPrivatePost(postId: string): Promise<number> {
  const post = await db.blogPost.findUnique({
    where: { id: postId },
    include: { audience: { select: { email: true } } },
  });

  if (!post || post.isDraft || post.visibility !== 'private') return 0;

  const emails = [...new Set(post.audience.map((entry) => entry.email.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return 0;

  const [blog, identity] = await Promise.all([
    getSiteContent('blog'),
    getSiteContent('identity'),
  ]);

  const siteName = identity.siteName || 'Studio';
  const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
  const urlPath = updatesPostPath(post.slug);
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const fullUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${urlPath}` : urlPath;

  let sent = 0;
  for (const email of emails) {
    const delivered = await sendTemplateEmail(email, {
      subject: `${siteName}: new collector update — ${title}`,
      html: `
        <p>A new studio update has been shared with you.</p>
        <p><strong>${escapeHtml(title)}</strong></p>
        <p><a href="${escapeHtml(fullUrl)}">View in ${escapeHtml(blog.privateSectionTitle || 'For collectors')}</a></p>
      `,
      text: `A new collector update is available: ${title}\n\nView: ${fullUrl}`,
    });
    if (delivered) sent += 1;
  }

  return sent;
}
