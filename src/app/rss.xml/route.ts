import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/markdown';
import { getPublishedSiteContent } from '@/lib/site-content';
import { getSiteUrl } from '@/lib/config';
import { UPDATES_PATH, updatesPostPath } from '@/lib/site-content-shared';
import { brandIconPath } from '@/lib/brand';
import { escapeHtml } from '@/lib/email-shell';
import { absoluteUrl } from '@/lib/utils';

export async function GET() {
  const [posts, identity, blog, siteUrl] = await Promise.all([
    getAllPosts(),
    getPublishedSiteContent('identity'),
    getPublishedSiteContent('blog'),
    getSiteUrl(),
  ]);
  const link = (path: string) => escapeHtml(absoluteUrl(path, siteUrl));
  const siteName = escapeHtml(identity.siteName);

  const rssItems = [...posts]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 20)
    .map(post => {
      const postUrl = link(updatesPostPath(post.slug));
      return `
    <item>
      <title>${escapeHtml(post.title)}</title>
      <description>${escapeHtml(post.excerpt)}</description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeHtml(post.author || identity.siteName)}</dc:creator>
      ${(post.tags || []).map(tag => `<category>${escapeHtml(tag)}</category>`).join('\n      ')}
    </item>`.trim();
    }).join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName} — ${escapeHtml(blog.title)}</title>
    <description>${escapeHtml(blog.subtitle)}</description>
    <link>${link(UPDATES_PATH)}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${link('/rss.xml')}" rel="self" type="application/rss+xml" />
    <copyright>Copyright © ${new Date().getFullYear()} ${escapeHtml(identity.copyrightName || identity.siteName)}</copyright>
    <ttl>60</ttl>
    <image>
      <url>${link(brandIconPath(identity, 180))}</url>
      <title>${siteName} — ${escapeHtml(blog.title)}</title>
      <link>${link(UPDATES_PATH)}</link>
    </image>
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
