import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { db } from '@/lib/db';
import {
  createConsignment,
  deleteConsignment,
  listConsignments,
  updateConsignment,
} from '@/lib/consignment';

function handleError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    await requireAdmin();
    const [placements, products] = await Promise.all([
      listConsignments(),
      db.product.findMany({
        orderBy: [{ title: 'asc' }],
        select: { id: true, title: true, price: true, category: true, availability: true },
      }),
    ]);
    return NextResponse.json({ placements, products });
  } catch (error) {
    return handleError(error, 'Failed to load consignment log');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const placement = await createConsignment(body, session.user.id);
    return NextResponse.json({ placement }, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to create consignment placement');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'Placement ID is required' }, { status: 400 });
    const placement = await updateConsignment(id, body, session.user.id);
    return NextResponse.json({ placement });
  } catch (error) {
    return handleError(error, 'Failed to update consignment placement');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'Placement ID is required' }, { status: 400 });
    await deleteConsignment(id, session.user.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, 'Failed to delete consignment placement');
  }
}
