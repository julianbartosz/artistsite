import { NextResponse } from 'next/server';

// Process liveness only: platform health checks poll this often, and touching the
// database here would keep a scale-to-zero database awake.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
