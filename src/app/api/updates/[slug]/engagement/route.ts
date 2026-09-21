import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { getServerSession } from 'next-auth';
import { authOptions, requireUser } from '@/lib/auth';
import { getPostBySlug } from '@/lib/markdown';
import {
  addPostComment,
  getPostEngagement,
  resolveGuestSessionId,
  togglePostLike,
} from '@/lib/update-engagement';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('like') }),
  z.object({ action: z.literal('comment'), body: z.string().min(1).max(2000) }),
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const guestSessionId = session?.user?.id ? null : await resolveGuestSessionId();
    const engagement = await getPostEngagement(slug, {
      userId: session?.user?.id,
      sessionId: guestSessionId,
    });
    return NextResponse.json({ engagement });
  } catch (error) {
    console.error('Engagement read error:', error);
    return NextResponse.json({ error: 'Failed to load engagement' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const payload = actionSchema.parse(await request.json());
    const session = await getServerSession(authOptions);
    const viewer = session?.user
      ? { id: session.user.id, email: session.user.email, isAdmin: Boolean(session.user.isAdmin) }
      : undefined;
    const post = await getPostBySlug(slug, false, viewer);
    if (!post) throw new ApiError(404, 'Update not found', 'POST_NOT_FOUND');

    if (payload.action === 'like') {
      const guestSessionId = session?.user?.id ? null : await resolveGuestSessionId();
      const result = await togglePostLike(slug, {
        userId: session?.user?.id,
        sessionId: guestSessionId,
      });
      return NextResponse.json(result);
    }

    const userSession = await requireUser();
    const comment = await addPostComment({
      postSlug: slug,
      userId: userSession.user.id,
      body: payload.body,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid engagement request', details: error.issues }, { status: 400 });
    }
    console.error('Engagement write error:', error);
    return NextResponse.json({ error: 'Failed to update engagement' }, { status: 500 });
  }
}
