import { createBrandIconResponse } from '@/lib/brand-icon-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Default favicon discovery path. Serves a 48×48 PNG so Google Search
 * can fetch it without hitting Disallow: /api/.
 */
export async function GET() {
  return createBrandIconResponse(48);
}
