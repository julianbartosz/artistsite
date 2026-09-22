import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import { createCollectorFeedToken } from '@/lib/collector-feed-token';

export async function GET() {
  try {
    const session = await requireUser();
    const token = await createCollectorFeedToken(session.user.id);
    const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    const feedUrl = origin
      ? `${origin.replace(/\/$/, '')}/rss-collector.xml?token=${encodeURIComponent(token)}`
      : `/rss-collector.xml?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ feedUrl, token });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Collector feed token error:', error);
    return NextResponse.json({ error: 'Failed to create feed URL' }, { status: 500 });
  }
}
