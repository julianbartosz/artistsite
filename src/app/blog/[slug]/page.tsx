import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, getPostSlugs } from '@/lib/markdown';
import { draftMode } from 'next/headers';
import { MDXContent } from '@/components/MDXContent';
import { generateBlogMetadata } from '@/lib/seo';
import { StructuredData, generateArticleSchema, generateBreadcrumbSchema } from '@/components/StructuredData';
import { db } from '@/lib/db';

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const post = await getPostBySlug(slug, isDraft);

  if (!post) {
    notFound();
  }

  await db.analyticsEvent.create({
    data: {
      eventName: 'blog_post_view',
      properties: JSON.stringify({ slug, title: post.title }),
      pageUrl: `/blog/${slug}`,
      timestamp: new Date(),
    },
  }).catch(() => undefined);

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.excerpt,
    author: post.author,
    publishedAt: post.publishedAt,
    url: `/blog/${slug}`,
    image: post.coverImage,
    tags: post.tags,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: post.title, url: `/blog/${slug}` },
  ]);

  return (
    <>
      <StructuredData data={articleSchema} />
      <StructuredData data={breadcrumbSchema} />

      <div className="min-h-screen bg-gray-50">
        <section className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-8 md:py-10">
            <nav className="mb-6" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <li><Link href="/" className="hover:text-gray-700">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/blog" className="hover:text-gray-700">Blog</Link></li>
                <li aria-hidden="true">/</li>
                <li className="text-gray-900 truncate">{post.title}</li>
              </ol>
            </nav>

            <header>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>

              <div className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                {post.author && <span>by {post.author}</span>}
                {post.readingTime && <span>{post.readingTime} min read</span>}
              </div>

              {post.excerpt && (
                <p className="text-lg text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>
              )}

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/blog/tag/${encodeURIComponent(tag.toLowerCase())}`}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </header>
          </div>
        </section>

        <article className="max-w-4xl mx-auto px-6 py-10 md:py-12">
          <MDXContent code={post.code} />

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <Link
              href="/blog"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              ← Back to Blog
            </Link>
          </footer>
        </article>
      </div>
    </>
  );
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: BlogPostProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return generateBlogMetadata({
    title: post.title,
    description: post.excerpt,
    publishedAt: post.publishedAt,
    author: post.author,
    tags: post.tags,
    coverImage: post.coverImage,
    slug,
  });
}
