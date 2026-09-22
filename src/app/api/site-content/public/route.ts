import { NextResponse } from 'next/server';
import { getAllPublicSiteContent } from '@/lib/site-content';

export async function GET() {
  try {
    const content = await getAllPublicSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load site content' }, { status: 500 });
  }
}
