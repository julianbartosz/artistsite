import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { getAllPosts, getPrivatePostsForViewer, BlogPost } from '@/lib/markdown';
import { authOptions } from '@/lib/auth';
import { getSiteContent, UPDATES_PATH, updatesFeedCopy, updatesTagPath } from '@/lib/site-content';
import { getEngagementStates, readGuestSessionId } from '@/lib/update-engagement';
import UpdatesFeedClient from '@/components/UpdatesFeedClient';

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
  const tagged = [...publicPosts, ...privatePosts]
    .filter((post) => tagMatches(post, normalizedTag))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const displayTag = decodeURIComponent(tag).trim();
  const engagement = await getEngagementStates(
    tagged.map((post) => post.slug),
    { userId: session?.user?.id, sessionId: await readGuestSessionId() },
  );

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

      <div className={`${blog.feedLayout === 'grid' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-6 py-12`}>
        {tagged.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
            No published updates use this tag yet.
          </div>
        ) : (
          <UpdatesFeedClient
            posts={tagged}
            layout={blog.feedLayout === 'grid' ? 'grid' : 'timeline'}
            copy={updatesFeedCopy(blog)}
            signedIn={Boolean(session?.user?.id)}
            signInCallbackUrl={updatesTagPath(displayTag)}
            engagement={engagement}
          />
        )}
      </div>
    </div>
  );
}
