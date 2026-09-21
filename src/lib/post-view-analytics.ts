import 'server-only';
import { db } from '@/lib/db';

export type PostViewRecord = {
  slug: string;
  title: string;
  visibility: string;
  viewerUserId: string | null;
  viewerEmail: string | null;
  timestamp: Date;
};

export type PrivatePostViewer = {
  email: string;
  userId: string | null;
  viewCount: number;
  lastViewedAt: string;
};

function parseViewProperties(raw: string): Partial<PostViewRecord> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      slug: typeof parsed.slug === 'string' ? parsed.slug : undefined,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      visibility: typeof parsed.visibility === 'string' ? parsed.visibility : undefined,
      viewerUserId: typeof parsed.viewerUserId === 'string' ? parsed.viewerUserId : null,
      viewerEmail: typeof parsed.viewerEmail === 'string' ? parsed.viewerEmail.trim().toLowerCase() : null,
    };
  } catch {
    return {};
  }
}

export async function recordBlogPostView(input: {
  slug: string;
  title: string;
  visibility: string;
  pageUrl: string;
  viewer?: { id?: string | null; email?: string | null };
}): Promise<void> {
  const viewerEmail = input.viewer?.email?.trim().toLowerCase() || null;
  const viewerUserId = input.viewer?.id || null;

  await db.analyticsEvent.create({
    data: {
      eventName: 'blog_post_view',
      properties: JSON.stringify({
        slug: input.slug,
        title: input.title,
        visibility: input.visibility,
        viewerUserId,
        viewerEmail,
      }),
      pageUrl: input.pageUrl,
      timestamp: new Date(),
    },
  }).catch(() => undefined);
}

export async function getPrivateViewersBySlug(slugs: string[]): Promise<Map<string, PrivatePostViewer[]>> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  const result = new Map<string, PrivatePostViewer[]>();
  if (uniqueSlugs.length === 0) return result;

  const slugSet = new Set(uniqueSlugs);
  const events = await db.analyticsEvent.findMany({
    where: { eventName: 'blog_post_view' },
    select: { properties: true, timestamp: true },
    orderBy: { timestamp: 'desc' },
  });

  const aggregates = new Map<string, Map<string, PrivatePostViewer>>();

  for (const event of events) {
    const props = parseViewProperties(event.properties);
    if (!props.slug || !slugSet.has(props.slug)) continue;
    if (props.visibility !== 'private') continue;
    if (!props.viewerEmail) continue;

    const byEmail = aggregates.get(props.slug) || new Map<string, PrivatePostViewer>();
    const existing = byEmail.get(props.viewerEmail);
    if (existing) {
      existing.viewCount += 1;
      if (event.timestamp.toISOString() > existing.lastViewedAt) {
        existing.lastViewedAt = event.timestamp.toISOString();
      }
    } else {
      byEmail.set(props.viewerEmail, {
        email: props.viewerEmail,
        userId: props.viewerUserId || null,
        viewCount: 1,
        lastViewedAt: event.timestamp.toISOString(),
      });
    }
    aggregates.set(props.slug, byEmail);
  }

  for (const slug of uniqueSlugs) {
    const viewers = aggregates.get(slug);
    result.set(
      slug,
      viewers
        ? [...viewers.values()].sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt))
        : [],
    );
  }

  return result;
}
