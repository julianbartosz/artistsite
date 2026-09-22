import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { moderateComment } from '@/lib/update-engagement';

const patchSchema = z.object({
  status: z.enum(['visible', 'hidden']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const payload = patchSchema.parse(await request.json());
    const comment = await moderateComment(id, payload.status);
    return NextResponse.json({ comment: { id: comment.id, status: comment.status } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid moderation request', details: error.issues }, { status: 400 });
    }
    console.error('Comment moderation error:', error);
    return NextResponse.json({ error: 'Failed to moderate comment' }, { status: 500 });
  }
}
