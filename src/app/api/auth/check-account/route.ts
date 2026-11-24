import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminEmail } from '@/lib/auth';

/**
 * Checks whether an email already has an account so the unified sign-in flow
 * can automatically route first-time visitors into account creation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const normalizedEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.includes(' ')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (user) {
      return NextResponse.json({ exists: true });
    }

    // Preserve deterministic local/E2E admin bootstrap without a pre-seeded user row.
    const isLocalBootstrap =
      (process.env.NODE_ENV !== 'production' || process.env.PLAYWRIGHT_E2E === 'true') &&
      isAdminEmail(normalizedEmail);

    return NextResponse.json({ exists: isLocalBootstrap });
  } catch (error) {
    console.error('Account lookup error:', error);
    return NextResponse.json({ error: 'Unable to verify account' }, { status: 500 });
  }
}
