import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const secret = (await getConfig('CRON_SECRET')) || process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Set a cron secret in Settings → Automation before running automations.' },
        { status: 503 }
      );
    }

    const cronUrl = new URL('/api/cron/marketing', request.nextUrl.origin);
    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin automation run error:', error);
    return NextResponse.json({ error: 'Failed to run automations' }, { status: 500 });
  }
}
