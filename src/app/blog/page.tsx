import Link from 'next/link';
import { getAllPosts, BlogPost } from '@/lib/markdown';

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-lg text-gray-600">
          Thoughts on art, creativity, and the artistic process.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No posts published yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post: BlogPost) => (
            <article key={post.slug} className="border-b border-gray-200 pb-8">
              <div className="mb-4">
                <Link 
                  href={`/blog/${post.slug}`}
                  className="text-2xl font-semibold hover:text-blue-600 transition-colors"
                >
                  {post.title}
                </Link>
              </div>
              
              <div className="text-sm text-gray-500 mb-3 flex items-center gap-4">
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
                {post.author && <span>by {post.author}</span>}
              </div>

              {post.excerpt && (
                <p className="text-gray-700 mb-4 leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag: string) => (
                    <span 
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Link 
                href={`/blog/${post.slug}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}