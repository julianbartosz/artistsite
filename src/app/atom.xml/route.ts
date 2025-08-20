import { NextResponse } from 'next/server';
import { getAllPosts } from '@domain/content';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
const siteName = 'Artist Site';
const siteDescription = 'Contemporary art blog featuring insights into creative process, techniques, and artistic inspiration';
const authorEmail = 'noreply@artistsite.com';
const authorName = 'Artist Site';

export async function GET() {
  const posts = await getAllPosts();
  const lastUpdated = new Date().toISOString();

  const atomItems = posts
    .filter(post => !post.isDraft)
    .slice(0, 20) // Limit to 20 most recent posts
    .map(post => {
      const postUrl = `${baseUrl}/blog/${post.slug}`;
      const published = new Date(post.publishedAt).toISOString();
      
      return `
    <entry>
      <title><![CDATA[${post.title}]]></title>
      <link href="${postUrl}" />
      <id>${postUrl}</id>
      <published>${published}</published>
      <updated>${published}</updated>
      <summary type="html"><![CDATA[${post.excerpt}]]></summary>
      <content type="html"><![CDATA[${post.excerpt}]]></content>
      <author>
        <name>${post.author || authorName}</name>
        <email>${authorEmail}</email>
      </author>
      ${post.tags ? post.tags.map(tag => `<category term="${tag}" />`).join('\n      ') : ''}
    </entry>`.trim();
    }).join('\n');

  const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[${siteName} Blog]]></title>
  <subtitle><![CDATA[${siteDescription}]]></subtitle>
  <link href="${baseUrl}/blog" />
  <link href="${baseUrl}/atom.xml" rel="self" type="application/atom+xml" />
  <id>${baseUrl}/blog</id>
  <updated>${lastUpdated}</updated>
  <generator uri="https://nextjs.org" version="14.0">Next.js</generator>
  <author>
    <name>${authorName}</name>
    <email>${authorEmail}</email>
    <uri>${baseUrl}</uri>
  </author>
  <icon>${baseUrl}/favicon.ico</icon>
  <logo>${baseUrl}/images/logo.png</logo>
  <rights>Copyright © ${new Date().getFullYear()} ${siteName}</rights>
${atomItems}
</feed>`;

  return new NextResponse(atomXml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}