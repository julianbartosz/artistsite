import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { getAllPosts, getPrivatePostsForViewer, BlogPost } from '@/lib/markdown';
import { authOptions } from '@/lib/auth';
import { getSiteContent, UPDATES_PATH, updatesPostPath } from '@/lib/site-content';
import PostMedia from '@/components/PostMedia';

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
  const blog = await getSiteContent('blog');

  return {
    title: `${decodedTag} - ${blog.title}`,
    description: `${blog.journalLabel} and ${blog.studioLabel.toLowerCase()} updates tagged ${decodedTag}.`,
  };
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { tag } = await params;
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) notFound();

  const [session, blog] = await Promise.all([
    getServerSession(authOptions),
    getSiteContent('blog'),
  ]);
  const viewer = session?.user
    ? { id: session.user.id, email: session.user.email, isAdmin: Boolean(session.user.isAdmin) }
    : undefined;
  const [publicPosts, privatePosts] = await Promise.all([
    getAllPosts(),
    blog.showPrivateSection ? getPrivatePostsForViewer(viewer) : Promise.resolve([]),
  ]);
  const tagged = [...publicPosts, ...privatePosts].filter((post) => tagMatches(post, normalizedTag));
  const displayTag = decodeURIComponent(tag).trim();

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <Link href={UPDATES_PATH} className="mb-6 inline-flex text-sm font-medium text-gray-700 hover:text-gray-900">
              Back to {blog.title}
            </Link>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">Tagged {displayTag}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Studio notes and journal posts related to {displayTag}.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {tagged.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
            No published updates use this tag yet.
          </div>
        ) : (
          <div className="space-y-8">
            {tagged.map((post) => (
              <article key={post.slug} className="border-b border-gray-200 pb-8 last:border-b-0">
                {post.media.length > 0 && (
                  <div className="mb-4">
                    <PostMedia items={post.media} title={post.title} />
                  </div>
                )}
                <header className="mb-4">
                  <h2 className="mb-2 text-2xl font-semibold">
                    <Link href={updatesPostPath(post.slug)} className="hover:text-gray-700 transition-colors">
                      {post.format === 'short' ? (post.excerpt || post.title) : post.title}
                    </Link>
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString()}</time>
                    {post.author && <span>by {post.author}</span>}
                  </div>
                </header>
                {post.format !== 'short' && post.excerpt && <p className="mb-4 leading-relaxed text-gray-700">{post.excerpt}</p>}
                <Link
                  href={updatesPostPath(post.slug)}
                  className="inline-flex items-center font-medium text-gray-900 hover:text-gray-700 group"
                >
                  View update
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
