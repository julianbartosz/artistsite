import { NextRequest } from 'next/server';
import { parseBrandIconSize } from '@/lib/brand';
import { createBrandIconResponse } from '@/lib/brand-icon-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** @deprecated Prefer /brand/icon — kept so older cached links still resolve. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseBrandIconSize(searchParams.get('size'));
  return createBrandIconResponse(size, searchParams.get('v'));
}
