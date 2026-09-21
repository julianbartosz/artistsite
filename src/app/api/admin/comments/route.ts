import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { listHiddenComments } from '@/lib/update-engagement';

export async function GET() {
  try {
    await requireAdmin();
    const comments = await listHiddenComments();
    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        postSlug: comment.postSlug,
        body: comment.body,
        authorName: comment.user.name || comment.user.email,
        updatedAt: comment.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Hidden comments list error:', error);
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
  }
}
