import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/markdown';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
const siteName = 'Artist Site';
const siteDescription = 'Contemporary art blog featuring insights into creative process, techniques, and artistic inspiration';

export async function GET() {
  const posts = await getAllPosts();
  const lastBuildDate = new Date().toUTCString();

  const rssItems = posts
    .filter(post => !post.isDraft)
    .slice(0, 20) // Limit to 20 most recent posts
    .map(post => {
      const postUrl = `${baseUrl}/blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      
      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${post.excerpt}]]></description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>noreply@artistsite.com (${post.author || 'Artist'})</author>
      ${post.tags ? post.tags.map(tag => `<category><![CDATA[${tag}]]></category>`).join('\n      ') : ''}
      <content:encoded><![CDATA[${post.excerpt}]]></content:encoded>
    </item>`.trim();
    }).join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteName} Blog]]></title>
    <description><![CDATA[${siteDescription}]]></description>
    <link>${baseUrl}/blog</link>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <generator>Next.js RSS Generator</generator>
    <webMaster>noreply@artistsite.com (Artist Site)</webMaster>
    <managingEditor>noreply@artistsite.com (Artist Site)</managingEditor>
    <copyright>Copyright © ${new Date().getFullYear()} ${siteName}</copyright>
    <category><![CDATA[Art]]></category>
    <category><![CDATA[Contemporary Art]]></category>
    <category><![CDATA[Creative Process]]></category>
    <ttl>60</ttl>
    
    <image>
      <url>${baseUrl}/images/rss-logo.png</url>
      <title><![CDATA[${siteName}]]></title>
      <link>${baseUrl}</link>
      <width>144</width>
      <height>144</height>
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