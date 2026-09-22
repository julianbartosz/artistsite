import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import {
  getAllAdminSiteContent,
  setSiteContent,
  SITE_CONTENT_PAGES,
  type SiteContentPage,
} from '@/lib/site-content';

const SavePayloadSchema = z.object({
  page: z.enum(SITE_CONTENT_PAGES),
  content: z.unknown(),
});

export async function GET() {
  try {
    await requireAdmin();
    const content = await getAllAdminSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to load site content' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = SavePayloadSchema.parse(await request.json());
    const saved = await setSiteContent(payload.page as SiteContentPage, payload.content);
    return NextResponse.json({ page: payload.page, content: saved });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid site content payload', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save site content' }, { status: 500 });
  }
}
