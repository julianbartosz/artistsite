import Link from 'next/link';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { getAllPosts, BlogPost } from '@/lib/markdown';
import { getSiteContent, listingHeroPaddingClass } from '@/lib/site-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const blog = await getSiteContent('blog');
  return {
    title: blog.title,
    description: blog.subtitle,
    openGraph: {
      title: blog.title,
      description: blog.subtitle,
      type: 'website',
    },
    alternates: {
      types: {
        'application/rss+xml': '/rss.xml',
        'application/atom+xml': '/atom.xml',
      },
    },
  };
}

// Loading component for better UX
function BlogPostSkeleton() {
  return (
    <article className="border-b border-gray-200 pb-8 animate-pulse">
      <div className="mb-4">
        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
      </div>
      <div className="text-sm text-gray-500 mb-3 flex items-center gap-4">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-24"></div>
    </article>
  );
}

async function BlogContent() {
  const posts = await getAllPosts();
  
  return (
    <>
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No posts published yet.</p>
          <p className="text-gray-400 mt-2">Check back soon for new content!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post: BlogPost) => (
            <article key={post.slug} className="border-b border-gray-200 pb-8 last:border-b-0">
              <header className="mb-4">
                <h2 className="text-2xl font-semibold mb-2">
                  <Link 
                    href={`/blog/${post.slug}`}
                    className="hover:text-gray-700 transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                
                <div className="text-sm text-gray-500 flex items-center gap-4">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>
                  {post.author && <span>by {post.author}</span>}
                  {post.readingTime && <span>{post.readingTime} min read</span>}
                </div>
              </header>
              
              {post.excerpt && (
                <p className="text-gray-700 mb-4 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
              
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/blog/tag/${encodeURIComponent(tag.toLowerCase())}`}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
              
              <footer>
                <Link 
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center text-gray-900 hover:text-gray-700 font-medium group"
                >
                  Read more
                  <span className="ml-1 transition-transform group-hover:translate-x-1">-&gt;</span>
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default async function BlogPage() {
  const blog = await getSiteContent('blog');
  const heroPadding = listingHeroPaddingClass(blog.hero.height);

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-white shadow-sm">
        <div className={`max-w-7xl mx-auto px-6 ${heroPadding}`}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{blog.title}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              {blog.subtitle}
            </p>

            {(blog.showSubscribe || blog.showRss) && (
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {blog.showSubscribe && (
              <Link
                href="/subscribe"
                className="btn-primary inline-flex items-center px-4 py-2 rounded-md"
              >
                {blog.subscribeLabel}
              </Link>
              )}
              {blog.showRss && (
              <>
              <Link
                href="/rss.xml"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                RSS Feed
              </Link>
              <Link
                href="/atom.xml"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Atom Feed
              </Link>
              </>
              )}
            </div>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <Suspense fallback={
          <div className="space-y-8">
            {[1, 2, 3].map(i => <BlogPostSkeleton key={i} />)}
          </div>
        }>
          <BlogContent />
        </Suspense>
      </div>
    </div>
  );
}