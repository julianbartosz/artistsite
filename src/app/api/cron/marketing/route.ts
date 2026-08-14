import { NextRequest, NextResponse } from 'next/server';
import { processDueCartRecovery, processDueEmailCampaigns, processDueSocialPosts } from '@/lib/marketing/campaign-execution';
import { InventoryService } from '@/lib/inventory';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const headerSecret = request.headers.get('x-cron-secret') || '';

  return bearer === secret || headerSecret === secret;
}

async function runScheduledMarketing(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [email, social, cartRecovery, expiredReservationsReleased] = await Promise.all([
    processDueEmailCampaigns(),
    processDueSocialPosts(),
    processDueCartRecovery(),
    InventoryService.releaseExpiredReservations(),
  ]);

  return NextResponse.json({
    success: true,
    processed: email.length + social.attempted + cartRecovery.attempted,
    results: { email, social, cartRecovery, inventory: { expiredReservationsReleased } },
  });
}

export async function GET(request: NextRequest) {
  return runScheduledMarketing(request);
}

export async function POST(request: NextRequest) {
  return runScheduledMarketing(request);
}
