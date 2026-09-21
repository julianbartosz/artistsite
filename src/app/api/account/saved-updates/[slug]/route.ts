import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireUser();
    const { slug } = await params;

    await db.savedUpdate.deleteMany({
      where: {
        userId: session.user.id,
        postSlug: slug,
      },
    });

    return NextResponse.json({ saved: false, postSlug: slug });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Saved update delete error:', error);
    return NextResponse.json({ error: 'Failed to remove saved update' }, { status: 500 });
  }
}
