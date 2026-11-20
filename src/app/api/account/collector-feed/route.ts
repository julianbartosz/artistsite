import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import { createCollectorFeedToken } from '@/lib/collector-feed-token';
import { getSiteUrl } from '@/lib/config';
import { absoluteUrl } from '@/lib/utils';

export async function GET() {
  try {
    const session = await requireUser();
    const token = await createCollectorFeedToken(session.user.id);
    const feedUrl = absoluteUrl(`/rss-collector.xml?${new URLSearchParams({ token })}`, await getSiteUrl());

    return NextResponse.json({ feedUrl, token });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Collector feed token error:', error);
    return NextResponse.json({ error: 'Failed to create feed URL' }, { status: 500 });
  }
}
