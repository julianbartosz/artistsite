import { createHmac, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

type FeedTokenPayload = {
  userId: string;
  exp: number;
};

function feedSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

function signBody(body: string): string {
  const secret = feedSecret();
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for collector feed tokens');
  }
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export async function createCollectorFeedToken(
  userId: string,
  expiresAt = Date.now() + MAX_AGE_MS,
): Promise<string> {
  const payload: FeedTokenPayload = {
    userId: userId.trim(),
    exp: expiresAt,
  };
  if (!payload.userId) {
    throw new Error('Collector feed token requires a user id');
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signBody(body)}`;
}

export async function verifyCollectorFeedToken(token: string | null | undefined): Promise<string | null> {
  const secret = feedSecret();
  if (!secret || !token || !token.includes('.')) return null;

  const [body, signature] = token.split('.', 2);
  if (!body || !signature) return null;

  let expected: string;
  try {
    expected = signBody(body);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FeedTokenPayload;
    if (!payload?.userId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload.userId.trim() || null;
  } catch {
    return null;
  }
}
