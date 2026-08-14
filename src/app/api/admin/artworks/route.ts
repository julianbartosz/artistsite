import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { artworkPayloadSchema, sanitizeArtworkPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: string }).code === 'P2002';
}

export async function GET() {
  try {
    await requireAdmin();
    const artworks = await db.artwork.findMany({ orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }] });
    return NextResponse.json({ artworks });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Admin artworks fetch error:', error);
    return NextResponse.json({ error: 'Failed to load artworks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = sanitizeArtworkPayload(artworkPayloadSchema.parse(await request.json()));
    const existingArtwork = await db.artwork.findFirst({
      where: { slug: payload.slug },
      select: { slug: true, title: true },
    });

    if (existingArtwork) {
      return NextResponse.json({ error: `Artwork already exists (${existingArtwork.slug}). Edit the existing item instead of creating a duplicate.` }, { status: 409 });
    }

    const artwork = await db.artwork.create({ data: payload });
    revalidateTag('artworks');
    revalidatePath('/portfolio');
    return NextResponse.json({ artwork }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid artwork data', details: error.issues }, { status: 400 });
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: 'Artwork already exists. Edit the existing item instead of creating a duplicate.' }, { status: 409 });
    console.error('Admin artwork create error:', error);
    return NextResponse.json({ error: 'Failed to create artwork' }, { status: 500 });
  }
}