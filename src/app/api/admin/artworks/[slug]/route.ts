import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { artworkPayloadSchema, sanitizeArtworkPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const payload = sanitizeArtworkPayload(artworkPayloadSchema.parse(await request.json()));
    const artwork = await db.artwork.update({ where: { slug }, data: payload });
    revalidateTag('artworks');
    revalidatePath('/portfolio');
    revalidatePath(`/portfolio/${artwork.slug}`);
    return NextResponse.json({ artwork });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid artwork data', details: error.issues }, { status: 400 });
    console.error('Admin artwork update error:', error);
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    await db.artwork.delete({ where: { slug } });
    revalidateTag('artworks');
    revalidatePath('/portfolio');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Admin artwork delete error:', error);
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 });
  }
}