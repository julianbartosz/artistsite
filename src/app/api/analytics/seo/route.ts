import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

const SeoPayloadSchema = z.object({
  url: z.string().max(500).optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  issues: z.array(z.string().max(300)).max(50).optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const seoData = SeoPayloadSchema.parse(await request.json());

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
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid SEO payload', details: error.issues }, { status: 400 });
    }
    console.error('Error processing SEO data:', error);
    return NextResponse.json(
      { error: 'Failed to process SEO data' },
      { status: 500 }
    );
  }
}
