import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStudioThreadForViewer } from '@/lib/studio-inbox';
import { subscribeThread } from '@/lib/realtime-hub';

export const dynamic = 'force-dynamic';

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const thread = await getStudioThreadForViewer(threadId, {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    });
    if (!thread) throw new ApiError(404, 'Conversation not found', 'THREAD_NOT_FOUND');

    let lastMessageAt = thread.messages.at(-1)?.createdAt || '';
    const knownIds = new Set(thread.messages.map((message) => message.id));

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const push = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseChunk(event, data)));
        };

        push('ready', { threadId });

        const unsubscribe = subscribeThread(threadId, (payload) => {
          if (knownIds.has(payload.message.id)) return;
          knownIds.add(payload.message.id);
          lastMessageAt = payload.message.createdAt;
          push('message', payload.message);
        });

        const poll = setInterval(async () => {
          try {
            const messages = await db.studioMessage.findMany({
              where: {
                threadId,
                ...(lastMessageAt ? { createdAt: { gt: new Date(lastMessageAt) } } : {}),
              },
              orderBy: { createdAt: 'asc' },
            });
            for (const message of messages) {
              if (knownIds.has(message.id)) continue;
              knownIds.add(message.id);
              lastMessageAt = message.createdAt.toISOString();
              push('message', {
                id: message.id,
                senderRole: message.senderRole,
                body: message.body,
                createdAt: message.createdAt.toISOString(),
              });
            }
          } catch {
            // Keep stream alive on transient read errors.
          }
        }, 2500);

        const heartbeat = setInterval(() => {
          push('ping', { at: new Date().toISOString() });
        }, 15000);

        const close = () => {
          clearInterval(poll);
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        };

        request.signal.addEventListener('abort', close);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(error.message, { status: error.status });
    }
    console.error('Message stream error:', error);
    return new Response('Failed to open stream', { status: 500 });
  }
}
