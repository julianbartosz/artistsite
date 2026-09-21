import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug } from '@/lib/markdown';
import { draftMode } from 'next/headers';
import { getServerSession } from 'next-auth';
import { MDXContent } from '@/components/MDXContent';
import PostMedia from '@/components/PostMedia';
import PostPermalinkActions from '@/components/PostPermalinkActions';
import PostEngagement from '@/components/PostEngagement';
import { generateBlogMetadata } from '@/lib/seo';
import { StructuredData, generateArticleSchema, generateBreadcrumbSchema } from '@/components/StructuredData';
import { authOptions } from '@/lib/auth';
import { getSiteContent, UPDATES_PATH, updatesPostPath, updatesTagPath } from '@/lib/site-content';
import { recordBlogPostView } from '@/lib/post-view-analytics';

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const [session, blog] = await Promise.all([
    getServerSession(authOptions),
    getSiteContent('blog'),
  ]);
  const viewer = session?.user
    ? { id: session.user.id, email: session.user.email, isAdmin: Boolean(session.user.isAdmin) }
    : undefined;
  const post = await getPostBySlug(slug, isDraft, viewer);

  if (!post) {
    notFound();
  }

  await recordBlogPostView({
    slug,
    title: post.title,
    visibility: post.visibility,
    pageUrl: updatesPostPath(slug),
    viewer: viewer ? { id: viewer.id, email: viewer.email } : undefined,
  });

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.excerpt,
    author: post.author,
    publishedAt: post.publishedAt,
    url: updatesPostPath(slug),
    image: post.coverImage || post.media.find((item) => item.type === 'image')?.url,
    tags: post.tags,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: blog.title, url: UPDATES_PATH },
    { name: post.title, url: updatesPostPath(slug) },
  ]);

  const isShort = post.format === 'short';

  return (
    <>
      {post.visibility === 'public' && <StructuredData data={articleSchema} />}
      {post.visibility === 'public' && <StructuredData data={breadcrumbSchema} />}

      <div className="min-h-screen bg-gray-50">
        <section className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-8 md:py-10">
            <nav className="mb-6" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <li><Link href="/" className="hover:text-gray-700">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href={UPDATES_PATH} className="hover:text-gray-700">{blog.title}</Link></li>
                <li aria-hidden="true">/</li>
                <li className="text-gray-900 truncate">{isShort ? (post.excerpt || post.title) : post.title}</li>
              </ol>
            </nav>

            <header>
              {post.visibility === 'private' && (
                <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {blog.privateSectionTitle}
                </p>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {isShort ? (post.excerpt || post.title) : post.title}
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
                {!isShort && post.readingTime && <span>{post.readingTime} min read</span>}
              </div>

              {post.pullQuote && (
                <blockquote className="mb-4 border-l-4 border-primary/30 pl-4 text-xl italic text-gray-700">{post.pullQuote}</blockquote>
              )}
              {!isShort && post.excerpt && (
                <p className="text-lg text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>
              )}
              {(post.location || post.processStage) && (
                <p className="mb-4 text-sm text-gray-500">
                  {[post.location, post.processStage].filter(Boolean).join(' · ')}
                </p>
              )}

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={updatesTagPath(tag)}
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
          {post.media.length > 0 && (
            <div className="mb-8">
              <PostMedia items={post.media} title={post.title} layout="detail" />
            </div>
          )}
          {!isShort && <MDXContent code={post.code} />}

          {(post.relatedProductId || post.relatedArtworkSlug) && (
            <div className="mt-10 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Related work</h2>
              <div className="flex flex-wrap gap-3">
                {post.relatedProductId && (
                  <Link href={`/shop/${post.relatedProductId}`} className="btn-primary-outline rounded-md px-4 py-2 text-sm">
                    View shop item
                  </Link>
                )}
                {post.relatedArtworkSlug && (
                  <Link href={`/portfolio/${post.relatedArtworkSlug}`} className="btn-primary-outline rounded-md px-4 py-2 text-sm">
                    View portfolio piece
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="mt-10 border-t border-gray-200 pt-8">
            <PostPermalinkActions
              slug={post.slug}
              title={post.title}
              askArtistLabel={blog.askArtistLabel}
              saveUpdateLabel={blog.saveUpdateLabel}
              signedIn={Boolean(session?.user?.id)}
              signInCallbackUrl={updatesPostPath(slug)}
            />
          </div>

          <PostEngagement
            slug={post.slug}
            signedIn={Boolean(session?.user?.id)}
            signInCallbackUrl={updatesPostPath(slug)}
            showComments={blog.showComments}
            showLikes={blog.showLikes}
            commentsLabel={blog.commentsLabel}
            likeLabel={blog.likeLabel}
            isAdmin={Boolean(session?.user?.isAdmin)}
          />

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <Link
              href={UPDATES_PATH}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              ← Back to {blog.title}
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
  const session = await getServerSession(authOptions);
  const viewer = session?.user
    ? { id: session.user.id, email: session.user.email, isAdmin: Boolean(session.user.isAdmin) }
    : undefined;
  const post = await getPostBySlug(slug, false, viewer);

  if (!post) {
    return {
      title: 'Post Not Found',
      robots: { index: false, follow: false },
    };
  }

  return generateBlogMetadata({
    title: post.title,
    description: post.excerpt,
    publishedAt: post.publishedAt,
    author: post.author,
    tags: post.tags,
    coverImage: post.coverImage || post.media.find((item) => item.type === 'image')?.url,
    slug,
    noIndex: post.visibility === 'private',
  });
}
