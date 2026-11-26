import {
  processDueCartRecovery,
  processDueEmailCampaigns,
  processDueSocialPosts,
  processDueSubscriberAutomations,
} from '@/lib/marketing/campaign-execution';
import { InventoryService } from '@/lib/inventory';
import { getConfig, setConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const AUTOMATION_INTERVAL_MINUTES = 30;

const LEASE_KEY = 'AUTOMATION_LEASE_UNTIL';
const LEASE_MS = 15 * 60 * 1000;

let schedulerStarted = false;

export async function resolveCronSecret(): Promise<string | undefined> {
  return (await getConfig('CRON_SECRET')) || process.env.CRON_SECRET;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

/**
 * A database lease keeps runs from overlapping across machines (deploys briefly run two)
 * and manual runs, so due campaigns and recovery emails are never sent twice.
 */
async function claimLease(): Promise<string | null> {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MS).toISOString();

  const claimed = await db.siteSetting.updateMany({
    where: { key: LEASE_KEY, value: { lt: now.toISOString() } },
    data: { value: until },
  });
  if (claimed.count === 1) return until;

  try {
    await db.siteSetting.create({ data: { key: LEASE_KEY, value: until } });
    return until;
  } catch (error) {
    if (isUniqueConstraintError(error)) return null;
    throw error;
  }
}

async function releaseLease(until: string): Promise<void> {
  await db.siteSetting.updateMany({
    where: { key: LEASE_KEY, value: until },
    data: { value: new Date(0).toISOString() },
  });
}

/** Runs every due automation once. Returns null when another run holds the lease. */
export async function runScheduledAutomations() {
  const lease = await claimLease();
  if (!lease) return null;

  try {
    const [
      email,
      social,
      cartRecovery,
      subscriberAutomations,
      expiredReservationsReleased,
      updatesDigest,
      marketFollowups,
      consignmentReminders,
    ] = await Promise.all([
      processDueEmailCampaigns(),
      processDueSocialPosts(),
      processDueCartRecovery(),
      processDueSubscriberAutomations(),
      InventoryService.releaseExpiredReservations(),
      import('@/lib/updates-digest').then((mod) => mod.processUpdatesDigests()),
      import('@/lib/markets').then((mod) => mod.processDueMarketFollowups()),
      import('@/lib/consignment').then((mod) => mod.processDueConsignmentReminders()),
    ]);

    const lastRunAt = new Date().toISOString();
    await setConfig('CRON_LAST_RUN_AT', lastRunAt, { encrypt: false });

    return {
      processed:
        email.length
        + social.attempted
        + cartRecovery.attempted
        + subscriberAutomations.welcomeFollowup.attempted
        + subscriberAutomations.winback.attempted
        + marketFollowups.attempted
        + consignmentReminders.attempted,
      lastRunAt,
      results: {
        email,
        social,
        cartRecovery,
        subscriberAutomations,
        inventory: { expiredReservationsReleased },
        updatesDigest,
        marketFollowups,
        consignmentReminders,
      },
    };
  } finally {
    await releaseLease(lease).catch((error) => console.error('Failed to release automation lease:', error));
  }
}

/**
 * Runs automations on clock-aligned intervals inside the server process with a database
 * lease so scheduled newsletters and follow-ups work automatically without an external cron service.
 */
export function startAutomationScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const intervalMs = AUTOMATION_INTERVAL_MINUTES * 60 * 1000;
  const scheduleNext = () => {
    setTimeout(async () => {
      try {
        await runScheduledAutomations();
      } catch (error) {
        console.error('Scheduled automations failed:', error);
      }
      scheduleNext();
    }, intervalMs - (Date.now() % intervalMs)).unref();
  };
  scheduleNext();
}
