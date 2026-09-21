import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import {
  createOrderInquiryThread,
  createPostInquiryThread,
  createStudioThread,
  listStudioThreadsForUser,
} from '@/lib/studio-inbox';
import { db } from '@/lib/db';
import { getOrderById } from '@/lib/orders';

const createThreadSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(5000),
  postSlug: z.string().min(1).optional(),
  postTitle: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  orderNumber: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const session = await requireUser();
    const email = session.user.email;
    if (!email) throw new ApiError(400, 'Account email is required', 'EMAIL_REQUIRED');

    const threads = await listStudioThreadsForUser(session.user.id, email);
    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Account messages list error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const email = session.user.email;
    if (!email) throw new ApiError(400, 'Account email is required', 'EMAIL_REQUIRED');

    const payload = createThreadSchema.parse(await request.json());
    const userName = session.user.name || email;

    if (payload.orderId) {
      const order = await getOrderById(payload.orderId);
      if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
      const ownsOrder = order.customerId === session.user.id || order.customerEmail.trim().toLowerCase() === email.trim().toLowerCase();
      if (!ownsOrder) throw new ApiError(403, 'Order not found', 'ORDER_NOT_FOUND');

      const result = await createOrderInquiryThread({
        userId: session.user.id,
        userEmail: email,
        userName,
        orderId: order.id,
        orderNumber: payload.orderNumber || order.orderNumber,
        message: payload.message,
      });
      return NextResponse.json({ threadId: result.thread.id }, { status: 201 });
    }

    if (payload.postSlug) {
      const post = await db.blogPost.findUnique({
        where: { slug: payload.postSlug },
        select: { title: true, excerpt: true, format: true },
      });
      const postTitle = payload.postTitle || post?.title || payload.postSlug;
      const result = await createPostInquiryThread({
        userId: session.user.id,
        userEmail: email,
        userName,
        postSlug: payload.postSlug,
        postTitle,
        message: payload.message,
      });
      return NextResponse.json({ threadId: result.thread.id }, { status: 201 });
    }

    const result = await createStudioThread({
      subject: payload.subject || 'Studio message',
      userEmail: email,
      userName,
      userId: session.user.id,
      initialBody: payload.message,
      senderRole: 'buyer',
      senderUserId: session.user.id,
    });

    return NextResponse.json({ threadId: result.thread.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid message data', details: error.issues }, { status: 400 });
    }
    console.error('Account message create error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
