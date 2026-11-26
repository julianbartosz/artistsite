import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import {
  createMarketEvent,
  deleteMarketEvent,
  getMarketWorkspaceData,
  sendMarketEventFollowup,
  updateMarketEvent,
} from '@/lib/markets';

function handleError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const eventId = request.nextUrl.searchParams.get('eventId');
    const workspace = await getMarketWorkspaceData(eventId);
    return NextResponse.json(workspace);
  } catch (error) {
    return handleError(error, 'Failed to load market workspace');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const event = await createMarketEvent(body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to create market event');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    if (body.action === 'send_followup') {
      const result = await sendMarketEventFollowup(id, { force: true });
      return NextResponse.json({ result });
    }

    const event = await updateMarketEvent(id, body);
    return NextResponse.json({ event });
  } catch (error) {
    return handleError(error, 'Failed to update market event');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    await deleteMarketEvent(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, 'Failed to delete market event');
  }
}
