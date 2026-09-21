import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { countUnreadThreadsForAdmin, createAdminOrderMessage, listStudioThreadsForAdmin } from '@/lib/studio-inbox';
import { getOrderById } from '@/lib/orders';

const createThreadSchema = z.object({
  orderId: z.string().min(1),
  message: z.string().min(1).max(5000),
});

export async function GET() {
  try {
    await requireAdmin();
    const [threads, unreadCount] = await Promise.all([
      listStudioThreadsForAdmin(),
      countUnreadThreadsForAdmin(),
    ]);
    return NextResponse.json({ threads, unreadCount });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin messages list error:', error);
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const payload = createThreadSchema.parse(await request.json());
    const order = await getOrderById(payload.orderId);
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');

    const result = await createAdminOrderMessage({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerUserId: order.customerId,
      customerName: order.customerEmail,
      message: payload.message,
      artistUserId: session.user.id,
    });

    return NextResponse.json({ threadId: result.thread.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid message data', details: error.issues }, { status: 400 });
    }
    console.error('Admin message create error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
