import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const token = String(body.token || '');
    const password = String(body.password || '');

    if (!email || !token || password.length < 8) {
      return NextResponse.json({ error: 'Email, reset token, and an 8-character password are required' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const verification = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
    if (!verification || verification.identifier !== email) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    if (verification.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => undefined);
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { password: hashedPassword } }),
      prisma.verificationToken.delete({ where: { token: tokenHash } }),
    ]);

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Unable to reset password' }, { status: 500 });
  }
}