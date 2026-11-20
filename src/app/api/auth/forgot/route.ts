import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { absoluteUrl } from '@/lib/utils';
import { generatePasswordResetEmail, getEmailBrand, sendTemplateEmail } from '@/lib/email';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const brand = await getEmailBrand();
    // Reset links are never built from request headers, which an attacker controls.
    if (user && !brand.siteUrl) {
      console.error('Password reset skipped: set the public site URL in Settings or NEXTAUTH_URL.');
    } else if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      await prisma.verificationToken.create({ data: { identifier: email, token: tokenHash, expires } });

      const resetUrl = absoluteUrl(
        `/auth/reset?${new URLSearchParams({ email, token })}`,
        brand.siteUrl,
      );
      await sendTemplateEmail(email, generatePasswordResetEmail(resetUrl, RESET_TOKEN_TTL_MINUTES, brand));
    }

    return NextResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Unable to process password reset request' }, { status: 500 });
  }
}