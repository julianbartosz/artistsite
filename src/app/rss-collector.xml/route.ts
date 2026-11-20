import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildCollectorFeedPosts } from '@/lib/updates-digest';
import { verifyCollectorFeedToken } from '@/lib/collector-feed-token';
import { UPDATES_PATH, updatesPostPath } from '@/lib/site-content-shared';
import { getPublishedSiteContent } from '@/lib/site-content';
import { getSiteUrl } from '@/lib/config';
import { escapeHtml } from '@/lib/email-shell';
import { absoluteUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const session = await getServerSession(authOptions);

  let userId = session?.user?.id || null;
  let email = session?.user?.email || null;

  if (!userId && token) {
    const verifiedUserId = await verifyCollectorFeedToken(token);
    if (verifiedUserId) {
      userId = verifiedUserId;
      const user = await import('@/lib/db').then(({ db }) => db.user.findUnique({
        where: { id: verifiedUserId },
        select: { email: true },
      }));
      email = user?.email || null;
    }
  }

  if (!userId || !email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const [blog, identity, posts, siteUrl] = await Promise.all([
    getPublishedSiteContent('blog'),
    getPublishedSiteContent('identity'),
    buildCollectorFeedPosts(userId, email),
    getSiteUrl(),
  ]);
  const link = (path: string) => escapeHtml(absoluteUrl(path, siteUrl));

  const rssItems = posts.slice(0, 50).map((post) => {
    const postUrl = link(updatesPostPath(post.slug));
    const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
    return `
    <item>
      <title>${escapeHtml(title)}</title>
      <description>${escapeHtml(post.excerpt)}</description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`.trim();
  }).join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(`${identity.siteName} — ${blog.privateSectionTitle}`)}</title>
    <description>${escapeHtml(blog.privateSectionSubtitle)}</description>
    <link>${link(`${UPDATES_PATH}?view=collectors`)}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
