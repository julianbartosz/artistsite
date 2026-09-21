import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { updatesPostPath } from '@/lib/site-content-shared';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const secret = process.env.PREVIEW_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Preview secret is not configured on the server.' }, { status: 503 });
    }
    const query = new URLSearchParams({ secret, slug });
    return NextResponse.json({ url: `/api/preview?${query.toString()}`, publicPath: updatesPostPath(slug) });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to build preview link' }, { status: 500 });
  }
}
