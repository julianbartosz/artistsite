import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { resolveCronSecret, runScheduledAutomations } from '@/lib/scheduled-automations';

export async function POST() {
  try {
    await requireAdmin();
    if (!(await resolveCronSecret())) {
      return NextResponse.json(
        { error: 'Set a cron secret in Settings → Automation before running automations.' },
        { status: 503 }
      );
    }

    const run = await runScheduledAutomations();
    if (!run) {
      return NextResponse.json(
        { error: 'Automations are already running. Try again in a few minutes.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, ...run });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin automation run error:', error);
    return NextResponse.json({ error: 'Failed to run automations' }, { status: 500 });
  }
}
