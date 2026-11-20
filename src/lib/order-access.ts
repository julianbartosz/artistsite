import { createHmac, timingSafeEqual } from 'crypto';

function orderAccessSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

export function createOrderAccessToken(orderId: string): string {
  const secret = orderAccessSecret();
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required to create order access tokens');
  }

  return createHmac('sha256', secret)
    .update(`order:${orderId}`)
    .digest('base64url');
}

export function verifyOrderAccessToken(orderId: string, token?: string | null): boolean {
  const secret = orderAccessSecret();
  if (!secret || !token) return false;

  const expected = createHmac('sha256', secret)
    .update(`order:${orderId}`)
    .digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);

  return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function createOrderTrackingPath(orderId: string): string {
  const safeOrderId = encodeURIComponent(orderId);

  try {
    return `/orders/${safeOrderId}?t=${encodeURIComponent(createOrderAccessToken(orderId))}`;
  } catch {
    return `/orders/${safeOrderId}`;
  }
}
