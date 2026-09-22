import type { MessageSenderRole } from '@/lib/studio-inbox-shared';

export type RealtimeMessagePayload = {
  threadId: string;
  message: {
    id: string;
    senderRole: MessageSenderRole;
    body: string;
    createdAt: string;
  };
};

type ThreadListener = (payload: RealtimeMessagePayload) => void;

const listeners = new Map<string, Set<ThreadListener>>();

export function subscribeThread(threadId: string, listener: ThreadListener): () => void {
  const set = listeners.get(threadId) || new Set();
  set.add(listener);
  listeners.set(threadId, set);
  return () => {
    const current = listeners.get(threadId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(threadId);
  };
}

export function publishThreadMessage(payload: RealtimeMessagePayload): void {
  const set = listeners.get(payload.threadId);
  if (!set) return;
  for (const listener of set) listener(payload);
}
