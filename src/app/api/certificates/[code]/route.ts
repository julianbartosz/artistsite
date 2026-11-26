import { NextRequest, NextResponse } from 'next/server';
import { getCertificateByCode } from '@/lib/certificates';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const certificate = await getCertificateByCode(code);
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }
    return NextResponse.json({ certificate });
  } catch {
    return NextResponse.json({ error: 'Could not verify certificate' }, { status: 500 });
  }
}
