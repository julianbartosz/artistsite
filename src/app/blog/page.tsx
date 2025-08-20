import Link from 'next/link';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { getAllPosts, BlogPost } from '@domain/content';
import { IconPencil } from '@ui/icons';

// Enable ISR with 30-minute revalidation for blog index
export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Art Blog - Creative Process & Insights',
  description: 'Read about my artistic journey, creative process, techniques, and inspiration behind my artwork. Explore art tutorials and behind-the-scenes content.',
  openGraph: {
    title: 'Art Blog - Creative Process & Insights',
    description: 'Read about my artistic journey, creative process, techniques, and inspiration behind my artwork.',
    type: 'website',
  },
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
      'application/atom+xml': '/atom.xml',
    },
  },
};

// Loading component for better UX
function BlogPostSkeleton() {
  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
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
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <IconPencil className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No posts published yet</h3>
          <p className="text-gray-600">Check back soon for new content!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post: BlogPost) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <article className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow h-full">
                <div className="p-6">
                  <header className="mb-4">
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition-colors">
                      {post.title}
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
                    <p className="text-gray-700 mb-4 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                  
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{post.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <footer>
                    <span className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium group text-sm">
                      Read more 
                      <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </footer>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default async function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - Matching site theme */}
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Art Blog</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Thoughts on art, creativity, and the artistic process. Discover insights into my creative journey, 
              techniques, and the stories behind my artwork.
            </p>
            
            {/* Subscribe and RSS Links */}
            <div className="flex flex-wrap gap-4 text-sm justify-center">
              <Link 
                href="/subscribe" 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Subscribe for Updates
              </Link>
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
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid - Matching portfolio layout */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <Suspense fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => <BlogPostSkeleton key={i} />)}
            </div>
          }>
            <BlogContent />
          </Suspense>
        </div>
      </section>

      {/* Info Section - Adding consistent footer */}
      <section className="bg-white py-16 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">About the Blog</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Creative Process</h3>
              <p className="text-gray-600">
                Behind-the-scenes insights into my artistic process, from initial concept to finished piece.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Techniques & Tips</h3>
              <p className="text-gray-600">
                Practical advice on painting, drawing, and mixed media techniques I&apos;ve developed over the years.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Art Stories</h3>
              <p className="text-gray-600">
                The inspiration and stories behind individual artworks and series.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/contact"
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}