import { createHmac, timingSafeEqual } from 'crypto';
import { getConfig } from '@/lib/config';

async function feedSecret(): Promise<string> {
  return (await getConfig('CRON_SECRET')) || process.env.NEXTAUTH_SECRET || 'dev-feed-secret';
}

export async function createCollectorFeedToken(userId: string): Promise<string> {
  const secret = await feedSecret();
  const payload = Buffer.from(userId, 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export async function verifyCollectorFeedToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const secret = await feedSecret();
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const userId = Buffer.from(payload, 'base64url').toString('utf8').trim();
    return userId || null;
  } catch {
    return null;
  }
}
