import { createHmac, timingSafeEqual } from 'crypto';
import type { CartItem } from '@/components/CartContext';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CartRecoveryPayload = {
  items: CartItem[];
  email?: string;
  exp: number;
};

function recoverySecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

function signBody(body: string): string {
  const secret = recoverySecret();
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for cart recovery tokens');
  }
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createCartRecoveryToken(
  items: CartItem[],
  email?: string,
  expiresAt = Date.now() + MAX_AGE_MS,
): string {
  const payload: CartRecoveryPayload = {
    items,
    email: email?.trim() || undefined,
    exp: expiresAt,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signBody(body)}`;
}

export function verifyCartRecoveryToken(token: string): CartRecoveryPayload | null {
  const secret = recoverySecret();
  if (!secret || !token.includes('.')) return null;

  const [body, signature] = token.split('.', 2);
  if (!body || !signature) return null;

  const expected = signBody(body);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length
    || !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CartRecoveryPayload;
    if (!payload || !Array.isArray(payload.items) || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildCartRecoveryPath(token: string): string {
  return `/checkout?recover=${encodeURIComponent(token)}`;
}
