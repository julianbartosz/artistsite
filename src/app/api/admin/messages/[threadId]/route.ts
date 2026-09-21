import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { appendStudioMessage, getStudioThreadForViewer, updateThreadCrm } from '@/lib/studio-inbox';
import { CRM_STAGES } from '@/lib/studio-inbox-shared';

const replySchema = z.object({
  message: z.string().min(1).max(5000),
});

const patchSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  crmStage: z.enum(CRM_STAGES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireAdmin();
    const { threadId } = await params;
    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: true,
    });
    if (!thread) throw new ApiError(404, 'Conversation not found', 'THREAD_NOT_FOUND');
    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin message thread error:', error);
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireAdmin();
    const { threadId } = await params;
    const payload = replySchema.parse(await request.json());

    const existing = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: true,
    });
    if (!existing) throw new ApiError(404, 'Conversation not found', 'THREAD_NOT_FOUND');

    await appendStudioMessage({
      threadId,
      body: payload.message,
      senderRole: 'artist',
      senderUserId: session.user.id,
    });

    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: true,
    });

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid message data', details: error.issues }, { status: 400 });
    }
    console.error('Admin message reply error:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const session = await requireAdmin();
    const { threadId } = await params;
    const payload = patchSchema.parse(await request.json());

    if (!payload.status && !payload.crmStage && !payload.tags) {
      throw new ApiError(400, 'No changes provided', 'NO_CHANGES');
    }

    await updateThreadCrm({
      threadId,
      status: payload.status,
      crmStage: payload.crmStage,
      tags: payload.tags,
    });

    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: true,
    });

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid update', details: error.issues }, { status: 400 });
    }
    console.error('Admin message patch error:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
