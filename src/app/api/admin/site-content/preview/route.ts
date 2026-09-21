import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import {
  CMS_PREVIEW_COOKIE,
  clearCmsPreviewSnapshot,
  setCmsPreviewSnapshot,
} from '@/lib/cms-preview';
import { type SiteContentByPage } from '@/lib/site-content-shared';

const PreviewPayloadSchema = z.object({}).catchall(z.unknown());

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = PreviewPayloadSchema.parse(await request.json()) as SiteContentByPage;
    await setCmsPreviewSnapshot(payload);

    const response = NextResponse.json({ success: true });
    response.cookies.set(CMS_PREVIEW_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid preview payload', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update preview' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await clearCmsPreviewSnapshot();
    const response = NextResponse.json({ success: true });
    response.cookies.set(CMS_PREVIEW_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to clear preview' }, { status: 500 });
  }
}
