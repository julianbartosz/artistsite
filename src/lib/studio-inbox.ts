import { db } from '@/lib/db';
import { publishThreadMessage } from '@/lib/realtime-hub';
import { CRM_STAGES, type CrmStage, type MessageSenderRole, type StudioMessageRecord, type StudioThreadSummary } from '@/lib/studio-inbox-shared';

export type { MessageSenderRole, StudioMessageRecord, StudioThreadSummary, CrmStage };
export { CRM_STAGES };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function previewBody(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim());
}

function parseCrmStage(value: unknown): CrmStage {
  if (typeof value === 'string' && (CRM_STAGES as readonly string[]).includes(value)) {
    return value as CrmStage;
  }
  return 'new';
}

function mapThreadSummary(thread: {
  id: string;
  subject: string;
  userEmail: string;
  userName: string | null;
  relatedPostSlug: string | null;
  relatedOrderId: string | null;
  status: string;
  crmStage: string;
  tags: unknown;
  lastMessageAt: Date;
  messages: { body: string }[];
}, unread: boolean): StudioThreadSummary {
  return {
    id: thread.id,
    subject: thread.subject,
    userEmail: thread.userEmail,
    userName: thread.userName,
    relatedPostSlug: thread.relatedPostSlug,
    relatedOrderId: thread.relatedOrderId,
    status: thread.status,
    crmStage: parseCrmStage(thread.crmStage),
    tags: parseTags(thread.tags),
    lastMessageAt: thread.lastMessageAt.toISOString(),
    unread,
    lastPreview: previewBody(thread.messages[0]?.body || ''),
  };
}

function threadUnreadForArtist(thread: { artistLastReadAt: Date | null; messages: { senderRole: string; createdAt: Date }[] }): boolean {
  const lastBuyer = [...thread.messages].reverse().find((message) => message.senderRole === 'buyer');
  if (!lastBuyer) return false;
  if (!thread.artistLastReadAt) return true;
  return lastBuyer.createdAt > thread.artistLastReadAt;
}

function threadUnreadForUser(thread: { userLastReadAt: Date | null; messages: { senderRole: string; createdAt: Date }[] }): boolean {
  const lastArtist = [...thread.messages].reverse().find((message) => message.senderRole === 'artist');
  if (!lastArtist) return false;
  if (!thread.userLastReadAt) return true;
  return lastArtist.createdAt > thread.userLastReadAt;
}

export async function createStudioThread(input: {
  subject: string;
  userEmail: string;
  userName?: string | null;
  userId?: string | null;
  relatedPostSlug?: string | null;
  relatedOrderId?: string | null;
  initialBody: string;
  senderRole?: MessageSenderRole;
  senderUserId?: string | null;
}) {
  const email = normalizeEmail(input.userEmail);
  const body = input.initialBody.trim();
  if (!body) throw new Error('Message body is required');

  return db.$transaction(async (tx) => {
    const thread = await tx.studioMessageThread.create({
      data: {
        subject: input.subject.trim() || 'Studio message',
        userEmail: email,
        userName: input.userName?.trim() || null,
        userId: input.userId || null,
        relatedPostSlug: input.relatedPostSlug?.trim() || null,
        relatedOrderId: input.relatedOrderId?.trim() || null,
        lastMessageAt: new Date(),
        userLastReadAt: input.senderRole === 'buyer' ? new Date() : null,
        artistLastReadAt: input.senderRole === 'artist' ? new Date() : null,
      },
    });

    const message = await tx.studioMessage.create({
      data: {
        threadId: thread.id,
        senderRole: input.senderRole || 'buyer',
        senderUserId: input.senderUserId || input.userId || null,
        body,
      },
    });

    return { thread, message };
  });
}

export async function appendStudioMessage(input: {
  threadId: string;
  body: string;
  senderRole: MessageSenderRole;
  senderUserId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error('Message body is required');

  return db.$transaction(async (tx) => {
    const message = await tx.studioMessage.create({
      data: {
        threadId: input.threadId,
        senderRole: input.senderRole,
        senderUserId: input.senderUserId || null,
        body,
      },
    });

    const readPatch = input.senderRole === 'artist'
      ? { artistLastReadAt: new Date() }
      : { userLastReadAt: new Date() };

    await tx.studioMessageThread.update({
      where: { id: input.threadId },
      data: {
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
        ...readPatch,
      },
    });

    publishThreadMessage({
      threadId: input.threadId,
      message: {
        id: message.id,
        senderRole: message.senderRole as MessageSenderRole,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    });

    return message;
  });
}

export async function listStudioThreadsForAdmin(): Promise<StudioThreadSummary[]> {
  const threads = await db.studioMessageThread.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const fullThreads = await db.studioMessageThread.findMany({
    where: { id: { in: threads.map((thread) => thread.id) } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  const unreadMap = new Map(fullThreads.map((thread) => [thread.id, threadUnreadForArtist(thread)]));

  return threads.map((thread) => mapThreadSummary(thread, unreadMap.get(thread.id) || false));
}

export async function listStudioThreadsForUser(userId: string, email: string): Promise<StudioThreadSummary[]> {
  const normalized = normalizeEmail(email);
  const threads = await db.studioMessageThread.findMany({
    where: {
      OR: [{ userId }, { userEmail: normalized }],
    },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const fullThreads = await db.studioMessageThread.findMany({
    where: { id: { in: threads.map((thread) => thread.id) } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  const unreadMap = new Map(fullThreads.map((thread) => [thread.id, threadUnreadForUser(thread)]));

  return threads.map((thread) => mapThreadSummary(thread, unreadMap.get(thread.id) || false));
}

export async function getStudioThreadForViewer(threadId: string, viewer: { id?: string | null; email?: string | null; isAdmin?: boolean }) {
  const thread = await db.studioMessageThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!thread) return null;

  const email = normalizeEmail(viewer.email || '');
  const allowed = Boolean(viewer.isAdmin)
    || (viewer.id && thread.userId === viewer.id)
    || (email && normalizeEmail(thread.userEmail) === email);

  if (!allowed) return null;

  if (viewer.isAdmin) {
    await db.studioMessageThread.update({
      where: { id: threadId },
      data: { artistLastReadAt: new Date() },
    });
  } else if (viewer.id || email) {
    await db.studioMessageThread.update({
      where: { id: threadId },
      data: { userLastReadAt: new Date(), ...(viewer.id && !thread.userId ? { userId: viewer.id } : {}) },
    });
  }

  return {
    id: thread.id,
    subject: thread.subject,
    userEmail: thread.userEmail,
    userName: thread.userName,
    relatedPostSlug: thread.relatedPostSlug,
    relatedOrderId: thread.relatedOrderId,
    status: thread.status,
    crmStage: parseCrmStage(thread.crmStage),
    tags: parseTags(thread.tags),
    messages: thread.messages.map((message) => ({
      id: message.id,
      senderRole: message.senderRole as MessageSenderRole,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function countUnreadThreadsForAdmin(): Promise<number> {
  const threads = await listStudioThreadsForAdmin();
  return threads.filter((thread) => thread.unread).length;
}

export async function updateThreadCrm(input: {
  threadId: string;
  crmStage?: CrmStage;
  tags?: string[];
  status?: 'open' | 'closed';
}) {
  const data: Record<string, unknown> = {};
  if (input.crmStage) data.crmStage = input.crmStage;
  if (input.tags) data.tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (input.status) data.status = input.status;
  if (Object.keys(data).length === 0) throw new Error('No CRM changes provided');

  return db.studioMessageThread.update({
    where: { id: input.threadId },
    data,
  });
}

export async function linkContactSubmissionToInbox(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  inquiryType?: string;
  userId?: string | null;
}) {
  const subject = input.subject.trim() || `Contact: ${input.inquiryType || 'general'}`;
  return createStudioThread({
    subject,
    userEmail: input.email,
    userName: input.name,
    userId: input.userId || null,
    initialBody: input.message,
    senderRole: 'buyer',
    senderUserId: input.userId || null,
  });
}

export async function createPostInquiryThread(input: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  postSlug: string;
  postTitle: string;
  message: string;
}) {
  return createStudioThread({
    subject: `About: ${input.postTitle}`,
    userEmail: input.userEmail,
    userName: input.userName || null,
    userId: input.userId,
    relatedPostSlug: input.postSlug,
    initialBody: input.message,
    senderRole: 'buyer',
    senderUserId: input.userId,
  });
}

export async function findOrderThread(orderId: string, userEmail: string) {
  const email = normalizeEmail(userEmail);
  return db.studioMessageThread.findFirst({
    where: {
      relatedOrderId: orderId.trim(),
      userEmail: email,
    },
    orderBy: { lastMessageAt: 'desc' },
  });
}

export async function createOrderInquiryThread(input: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  orderId: string;
  orderNumber: string;
  message: string;
}) {
  const existing = await findOrderThread(input.orderId, input.userEmail);
  if (existing) {
    const message = await appendStudioMessage({
      threadId: existing.id,
      body: input.message,
      senderRole: 'buyer',
      senderUserId: input.userId,
    });
    return { thread: existing, message, created: false as const };
  }

  const created = await createStudioThread({
    subject: `Order #${input.orderNumber}`,
    userEmail: input.userEmail,
    userName: input.userName || null,
    userId: input.userId,
    relatedOrderId: input.orderId,
    initialBody: input.message,
    senderRole: 'buyer',
    senderUserId: input.userId,
  });
  return { ...created, created: true as const };
}

export async function createAdminOrderMessage(input: {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  customerUserId?: string | null;
  customerName?: string | null;
  message: string;
  artistUserId: string;
}) {
  const email = normalizeEmail(input.customerEmail);
  const existing = await db.studioMessageThread.findFirst({
    where: { relatedOrderId: input.orderId.trim(), userEmail: email },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (existing) {
    const message = await appendStudioMessage({
      threadId: existing.id,
      body: input.message,
      senderRole: 'artist',
      senderUserId: input.artistUserId,
    });
    return { thread: existing, message, created: false as const };
  }

  const created = await createStudioThread({
    subject: `Order #${input.orderNumber}`,
    userEmail: email,
    userName: input.customerName || null,
    userId: input.customerUserId || null,
    relatedOrderId: input.orderId,
    initialBody: input.message,
    senderRole: 'artist',
    senderUserId: input.artistUserId,
  });
  return { ...created, created: true as const };
}
