import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getAllPosts, BlogPost } from '@/lib/markdown';

interface BlogTagPageProps {
  params: Promise<{ tag: string }>;
}

export const dynamic = 'force-dynamic';

function normalizeTag(value: string): string {
  return decodeURIComponent(value).trim().toLowerCase();
}

function tagMatches(post: BlogPost, tag: string): boolean {
  return Boolean(post.tags?.some((candidate) => candidate.toLowerCase() === tag));
}

export async function generateMetadata({ params }: BlogTagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag).trim();

  return {
    title: `${decodedTag} - Art Blog`,
    description: `Read blog posts tagged ${decodedTag}.`,
  };
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { tag } = await params;
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) notFound();

  const posts = (await getAllPosts()).filter((post) => tagMatches(post, normalizedTag));
  const displayTag = decodeURIComponent(tag).trim();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <Link href="/blog" className="mb-6 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
              Back to all posts
            </Link>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">Posts Tagged {displayTag}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Studio notes and essays related to {displayTag}.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {posts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
            No published posts use this tag yet.
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.slug} className="border-b border-gray-200 pb-8 last:border-b-0">
                <header className="mb-4">
                  <h2 className="mb-2 text-2xl font-semibold">
                    <Link href={`/blog/${post.slug}`} className="hover:text-blue-600 transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString()}</time>
                    {post.author && <span>by {post.author}</span>}
                    {post.readingTime && <span>{post.readingTime} min read</span>}
                  </div>
                </header>
                {post.excerpt && <p className="mb-4 leading-relaxed text-gray-700">{post.excerpt}</p>}
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700 group"
                >
                  Read more
                  <span className="ml-1 transition-transform group-hover:translate-x-1">-&gt;</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}