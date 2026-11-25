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
  const recentPosts = [...posts]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 20);
  const updated = recentPosts[0] ? new Date(recentPosts[0].publishedAt).toISOString() : new Date().toISOString();

  const atomItems = recentPosts.map(post => {
    const postUrl = link(updatesPostPath(post.slug));
    const published = new Date(post.publishedAt).toISOString();
    return `
    <entry>
      <title>${escapeHtml(post.title)}</title>
      <link href="${postUrl}" />
      <id>${postUrl}</id>
      <published>${published}</published>
      <updated>${published}</updated>
      <summary>${escapeHtml(post.excerpt)}</summary>
      <author>
        <name>${escapeHtml(post.author || identity.siteName)}</name>
      </author>
      ${(post.tags || []).map(tag => `<category term="${escapeHtml(tag)}" />`).join('\n      ')}
    </entry>`.trim();
  }).join('\n');

  const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${siteName} — ${escapeHtml(blog.title)}</title>
  <subtitle>${escapeHtml(blog.subtitle)}</subtitle>
  <link href="${link(UPDATES_PATH)}" />
  <link href="${link('/atom.xml')}" rel="self" type="application/atom+xml" />
  <id>${link(UPDATES_PATH)}</id>
  <updated>${updated}</updated>
  <author>
    <name>${siteName}</name>
    <uri>${link('/')}</uri>
  </author>
  <icon>${link(brandIconPath(identity, 48))}</icon>
  <logo>${link(brandIconPath(identity, 512))}</logo>
  <rights>Copyright © ${new Date().getFullYear()} ${escapeHtml(identity.copyrightName || identity.siteName)}</rights>
${atomItems}
</feed>`;

  return new NextResponse(atomXml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
