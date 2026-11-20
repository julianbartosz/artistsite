import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeNewsletterEmail, verifyUnsubscribeToken } from '@/lib/newsletter-subscribers';

export const dynamic = 'force-dynamic';

/**
 * RFC 8058 one-click endpoint (inbox providers POST `List-Unsubscribe=One-Click` to the
 * tokenized URL) and the target of the /unsubscribe confirmation form.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const formToken = form?.get('token');
  const token = request.nextUrl.searchParams.get('token') || (typeof formToken === 'string' ? formToken : '');
  const email = verifyUnsubscribeToken(token);
  if (email) await unsubscribeNewsletterEmail(email);

  if (form?.get('source') === 'page') {
    const page = new URL('/unsubscribe', request.nextUrl);
    page.searchParams.set('token', token);
    if (email) page.searchParams.set('done', '1');
    return NextResponse.redirect(page, 303);
  }

  return email
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'This unsubscribe link is invalid.' }, { status: 400 });
}
