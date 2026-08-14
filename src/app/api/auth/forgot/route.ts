import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getConfig } from '@/lib/config';
import { generatePasswordResetEmail, sendTemplateEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_TOKEN_TTL_MINUTES = RESET_TOKEN_TTL_MS / 60_000;

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function resetBaseUrl(request: NextRequest): Promise<string> {
  const configured = await getConfig('NEXT_PUBLIC_SITE_URL') || await getConfig('NEXT_PUBLIC_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      await prisma.verificationToken.create({ data: { identifier: email, token: tokenHash, expires } });

      const baseUrl = await resetBaseUrl(request);
      const resetUrl = `${baseUrl}/auth/reset?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
      await sendTemplateEmail(email, generatePasswordResetEmail(resetUrl, RESET_TOKEN_TTL_MINUTES));
    }

    return NextResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Unable to process password reset request' }, { status: 500 });
  }
}