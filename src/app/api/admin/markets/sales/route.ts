import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import {
  getMarketWorkspaceData,
  recordInPersonSale,
  voidInPersonSale,
} from '@/lib/markets';
import { buildMarketSalesCsv, MARKET_PAYMENT_METHODS, type MarketPaymentMethod } from '@/lib/market-qr';

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
    const format = request.nextUrl.searchParams.get('format');
    const workspace = await getMarketWorkspaceData(eventId);

    if (format === 'csv') {
      const csv = buildMarketSalesCsv(workspace.sales);
      const event = eventId ? workspace.events.find((e) => e.id === eventId) : null;
      const filename = event ? `market-sales-${event.slug}.csv` : 'market-sales-all.csv';
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ sales: workspace.sales, summary: workspace.summary });
  } catch (error) {
    return handleError(error, 'Failed to load market sales');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validMethods = new Set<string>(MARKET_PAYMENT_METHODS.map((m) => m.key));
    const paymentMethod: MarketPaymentMethod = validMethods.has(body?.paymentMethod)
      ? body.paymentMethod
      : 'cash';

    const result = await recordInPersonSale({
      marketEventId: typeof body?.marketEventId === 'string' && body.marketEventId.trim() ? body.marketEventId.trim() : null,
      paymentMethod,
      items: Array.isArray(body?.items) ? body.items : [],
      discountAmount: body?.discountAmount,
      taxRate: body?.taxRate,
      taxIncluded: body?.taxIncluded === true,
      buyerEmail: body?.buyerEmail,
      buyerName: body?.buyerName,
      subscribeToFollowUp: body?.subscribeToFollowUp === true,
      sendReceipt: body?.sendReceipt !== false,
      notes: body?.notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to record in-person sale');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const orderId = request.nextUrl.searchParams.get('orderId')?.trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    const result = await voidInPersonSale(orderId);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, 'Failed to void sale');
  }
}
