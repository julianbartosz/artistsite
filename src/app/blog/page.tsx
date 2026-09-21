import Link from 'next/link';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { getAllPosts, getPrivatePostsForViewer, type BlogPost } from '@/lib/markdown';
import { authOptions } from '@/lib/auth';
import { getSiteContent, listingHeroPaddingClass, UPDATES_PATH, updatesPostPath, updatesTagPath } from '@/lib/site-content';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';
import UpdatesFeedClient from '@/components/UpdatesFeedClient';

export const dynamic = 'force-dynamic';

type UpdatesSearch = {
  view?: string | string[];
  kind?: string | string[];
};

function firstParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

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
      canonical: UPDATES_PATH,
      types: {
        'application/rss+xml': '/rss.xml',
        'application/atom+xml': '/atom.xml',
      },
    },
  };
}

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
    </article>
  );
}

function updatesHref(params: { view?: string; kind?: string }): string {
  const search = new URLSearchParams();
  if (params.view && params.view !== 'public') search.set('view', params.view);
  if (params.kind && params.kind !== 'all') search.set('kind', params.kind);
  const query = search.toString();
  return query ? `${UPDATES_PATH}?${query}` : UPDATES_PATH;
}

async function UpdatesFeed({
  view,
  kind,
}: {
  view: 'public' | 'collectors';
  kind: 'all' | 'article' | 'short';
}) {
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

  const source = view === 'collectors' ? privatePosts : publicPosts;
  const posts = kind === 'all' ? source : source.filter((post) => post.format === kind);
  const signedIn = Boolean(session?.user?.id);
  const layout = blog.feedLayout === 'grid' ? 'grid' : 'timeline';

  if (view === 'collectors' && !signedIn && !viewer?.isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <h2 className="text-xl font-semibold text-gray-900">{blog.privateSectionTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-gray-600">{blog.privateSectionSubtitle}</p>
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent(updatesHref({ view: 'collectors', kind }))}`}
          className="btn-primary mt-6 inline-flex items-center rounded-md px-4 py-2"
        >
          {blog.privateSignInLabel}
        </Link>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-gray-500">
          {view === 'collectors' ? 'No collector updates are shared with this account yet.' : 'No posts published yet.'}
        </p>
        <p className="mt-2 text-gray-400">
          {view === 'collectors' ? 'When the artist shares a private update with you, it will appear here.' : 'Check back soon for new content!'}
        </p>
      </div>
    );
  }

  if (layout === 'grid' || layout === 'timeline') {
    return (
      <UpdatesFeedClient
        posts={posts}
        layout={layout}
        journalLabel={blog.journalLabel}
        studioLabel={blog.studioLabel}
        signedIn={signedIn}
        quickLookLabel={blog.quickLookLabel}
        saveUpdateLabel={blog.saveUpdateLabel}
        askArtistLabel={blog.askArtistLabel}
        featuredLabel={blog.featuredLabel}
        showFeedDate={blog.showFeedDate}
        showFeedAuthor={blog.showFeedAuthor}
        showFeedTags={blog.showFeedTags}
        showComments={blog.showComments}
        showLikes={blog.showLikes}
        commentsLabel={blog.commentsLabel}
        likeLabel={blog.likeLabel}
      />
    );
  }

  return null;
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<UpdatesSearch> }) {
  const params = await searchParams;
  const blog = await getSiteContent('blog');
  const heroPadding = listingHeroPaddingClass(blog.hero.height);
  const view = firstParam(params.view) === 'collectors' ? 'collectors' : 'public';
  const kindRaw = firstParam(params.kind);
  const kind = kindRaw === 'article' || kindRaw === 'short' ? kindRaw : 'all';

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative group bg-white shadow-sm">
        <CmsEditAnchor targetKey="blog:listing" />
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

      <div className={`${blog.feedLayout === 'grid' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-6 py-12`}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {blog.showPrivateSection && (
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <Link
                href={updatesHref({ view: 'public', kind })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'public' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {blog.publicTabLabel}
              </Link>
              <Link
                href={updatesHref({ view: 'collectors', kind })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'collectors' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {blog.privateSectionTitle}
              </Link>
            </div>
          )}
          {blog.showFormatFilters && (
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'all', label: blog.allFilterLabel },
                { value: 'short', label: blog.studioLabel },
                { value: 'article', label: blog.journalLabel },
              ] as const).map((filter) => (
                <Link
                  key={filter.value}
                  href={updatesHref({ view, kind: filter.value })}
                  className={`rounded-full px-3 py-1 text-sm ${kind === filter.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900'}`}
                >
                  {filter.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Suspense fallback={
          <div className="space-y-8">
            {[1, 2, 3].map(i => <BlogPostSkeleton key={i} />)}
          </div>
        }>
          <UpdatesFeed view={view} kind={kind} />
        </Suspense>
      </div>
    </div>
  );
}
