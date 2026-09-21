import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import { appendStudioMessage, getStudioThreadForViewer } from '@/lib/studio-inbox';

const replySchema = z.object({
  message: z.string().min(1).max(5000),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireUser();
    const { threadId } = await params;
    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    });

    if (!thread) throw new ApiError(404, 'Conversation not found', 'THREAD_NOT_FOUND');
    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Account message thread error:', error);
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireUser();
    const { threadId } = await params;
    const payload = replySchema.parse(await request.json());

    const existing = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    });
    if (!existing) throw new ApiError(404, 'Conversation not found', 'THREAD_NOT_FOUND');

    await appendStudioMessage({
      threadId,
      body: payload.message,
      senderRole: 'buyer',
      senderUserId: session.user.id,
    });

    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    });

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid message data', details: error.issues }, { status: 400 });
    }
    console.error('Account message reply error:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
