import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildCollectorFeedPosts } from '@/lib/updates-digest';
import { verifyCollectorFeedToken } from '@/lib/collector-feed-token';
import { UPDATES_PATH, updatesPostPath } from '@/lib/site-content-shared';
import { getSiteContent } from '@/lib/site-content';

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

  const [blog, identity, posts] = await Promise.all([
    getSiteContent('blog'),
    getSiteContent('identity'),
    buildCollectorFeedPosts(userId, email),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://artistsite.com';
  const siteName = identity.siteName || 'Artist Site';
  const lastBuildDate = new Date().toUTCString();

  const rssItems = posts.slice(0, 50).map((post) => {
    const postUrl = `${baseUrl.replace(/\/$/, '')}${updatesPostPath(post.slug)}`;
    const title = post.format === 'short' ? (post.excerpt || post.title) : post.title;
    return `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${post.excerpt}]]></description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`.trim();
  }).join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${siteName} — ${blog.privateSectionTitle}]]></title>
    <description><![CDATA[Private collector updates feed]]></description>
    <link>${baseUrl}${UPDATES_PATH}?view=collectors</link>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
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
