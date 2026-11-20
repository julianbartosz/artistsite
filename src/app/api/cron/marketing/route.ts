import { NextRequest, NextResponse } from 'next/server';
import { resolveCronSecret, runScheduledAutomations } from '@/lib/scheduled-automations';

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const headerSecret = request.headers.get('x-cron-secret') || '';

  return bearer === secret || headerSecret === secret;
}

async function runScheduledMarketing(request: NextRequest) {
  const secret = await resolveCronSecret();
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = await runScheduledAutomations();
  if (!run) {
    return NextResponse.json({ error: 'Automations are already running. Try again in a few minutes.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, ...run });
}

export async function GET(request: NextRequest) {
  return runScheduledMarketing(request);
}

export async function POST(request: NextRequest) {
  return runScheduledMarketing(request);
}
