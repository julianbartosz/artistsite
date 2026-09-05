import { NextRequest, NextResponse } from 'next/server';
import { processDueCartRecovery, processDueEmailCampaigns, processDueSocialPosts } from '@/lib/marketing/campaign-execution';
import { InventoryService } from '@/lib/inventory';
import { getConfig, setConfig } from '@/lib/config';

async function resolveCronSecret(): Promise<string | undefined> {
  return (await getConfig('CRON_SECRET')) || process.env.CRON_SECRET;
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = await resolveCronSecret();
  if (!secret) return false;

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

  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [email, social, cartRecovery, expiredReservationsReleased] = await Promise.all([
    processDueEmailCampaigns(),
    processDueSocialPosts(),
    processDueCartRecovery(),
    InventoryService.releaseExpiredReservations(),
  ]);

  await setConfig('CRON_LAST_RUN_AT', new Date().toISOString(), { encrypt: false });
  const lastRunAt = await getConfig('CRON_LAST_RUN_AT');

  return NextResponse.json({
    success: true,
    processed: email.length + social.attempted + cartRecovery.attempted,
    lastRunAt,
    results: { email, social, cartRecovery, inventory: { expiredReservationsReleased } },
  });
}

export async function GET(request: NextRequest) {
  return runScheduledMarketing(request);
}

export async function POST(request: NextRequest) {
  return runScheduledMarketing(request);
}
