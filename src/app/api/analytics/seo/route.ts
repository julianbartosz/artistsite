import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const seoData = await request.json();
    
    // In development, just log the SEO data
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 SEO Data received:', {
        url: seoData.url,
        title: seoData.title,
        description: seoData.description?.substring(0, 100) + '...',
        issues: seoData.issues || [],
        timestamp: seoData.timestamp
      });
    }
    
    // TODO: In production, you could store this in analytics database
    // await db.analyticsEvent.create({
    //   data: {
    //     eventName: 'seo_check',
    //     properties: JSON.stringify(seoData),
    //     timestamp: new Date(seoData.timestamp)
    //   }
    // });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing SEO data:', error);
    return NextResponse.json(
      { error: 'Failed to process SEO data' },
      { status: 500 }
    );
  }
}