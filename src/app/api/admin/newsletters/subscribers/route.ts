import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ApiError, jsonErrorResponse } from '@/lib/api-error-handler';
import {
  isNewsletterSubscriber,
  listNewsletterSubscribers,
  normalizeSubscriberEmail,
  recordNewsletterSubscriber,
  unsubscribeNewsletterEmail,
} from '@/lib/newsletter-subscribers';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 200;

/** Quotes every cell and neutralizes leading formula characters so spreadsheets never execute imported values. */
function csvCell(value: string): string {
  const safe = value && '=+-@\t\r'.includes(value[0]) ? `'${value}` : value;
  return `"${safe.split('"').join('""')}"`;
}

function requireEmail(value: unknown): string {
  const email = normalizeSubscriberEmail(value);
  if (!email) throw new ApiError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  return email;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const subscribers = await listNewsletterSubscribers(searchParams.get('q') ?? '');

    if (searchParams.get('format') === 'csv') {
      const rows = [
        ['email', 'first_name', 'subscribed_at'],
        ...subscribers.map((subscriber) => [subscriber.email, subscriber.firstName ?? '', subscriber.subscribedAt]),
      ];
      return new NextResponse(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ subscribers: subscribers.slice(0, PAGE_SIZE), total: subscribers.length });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to load subscribers');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { email: raw } = z.object({ email: z.string() }).parse(await request.json());
    const email = requireEmail(raw);
    if (await isNewsletterSubscriber(email)) {
      throw new ApiError(409, `${email} is already subscribed.`, 'ALREADY_SUBSCRIBED');
    }
    await recordNewsletterSubscriber(email);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to add subscriber');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const email = requireEmail(new URL(request.url).searchParams.get('email'));
    await unsubscribeNewsletterEmail(email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to remove subscriber');
  }
}
