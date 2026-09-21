import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const seoData = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('SEO Data received:', {
        url: seoData.url,
        title: seoData.title,
        description: seoData.description?.substring(0, 100) + '...',
        issues: seoData.issues || [],
        timestamp: seoData.timestamp,
      });
    }

    await db.analyticsEvent.create({
      data: {
        eventName: 'seo_check',
        properties: JSON.stringify(seoData),
        timestamp: seoData.timestamp ? new Date(seoData.timestamp) : new Date(),
      },
    }).catch((error) => {
      console.error('Failed to persist SEO analytics event:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing SEO data:', error);
    return NextResponse.json(
      { error: 'Failed to process SEO data' },
      { status: 500 }
    );
  }
}
