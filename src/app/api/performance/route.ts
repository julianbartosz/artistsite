import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getConfig } from '@/lib/config';

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  url: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const metrics: WebVitalsMetric[] = await request.json();
    
    // In production, you would send this to your analytics service
    // For now, we'll log and store in memory/database
    console.log('Web Vitals metrics received:', metrics);
    await Promise.all(metrics.map((metric) => db.analyticsEvent.create({
      data: {
        eventName: 'web_vital',
        properties: JSON.stringify(metric),
        pageUrl: metric.url,
        timestamp: new Date(metric.timestamp || Date.now()),
      },
    }).catch((error) => {
      console.error('Failed to persist web vital metric:', error);
    })));
    
    // You could implement analytics here:
    // - Send to Google Analytics 4
    // - Store in database for reporting
    // - Send to monitoring service like DataDog or New Relic
    
    // Example: Send to Google Analytics 4
    if (await getConfig('NEXT_PUBLIC_GA4_MEASUREMENT_ID')) {
      for (const metric of metrics) {
        await sendToGA4(metric);
      }
    }
    
    return NextResponse.json({ success: true, received: metrics.length });
  } catch (error) {
    console.error('Error processing performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

async function sendToGA4(metric: WebVitalsMetric) {
  const measurementId = await getConfig('NEXT_PUBLIC_GA4_MEASUREMENT_ID');
  const apiSecret = await getConfig('GA_API_SECRET');
  
  if (!measurementId || !apiSecret) {
    return;
  }
  
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: metric.id,
        events: [{
          name: 'web_vital',
          params: {
            metric_name: metric.name,
            metric_value: metric.value,
            metric_rating: metric.rating,
            page_location: metric.url,
          }
        }]
      }),
    });
  } catch (error) {
    console.error('Failed to send metric to GA4:', error);
  }
}

// GET endpoint for retrieving performance data
export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await db.analyticsEvent.findMany({
      where: {
        eventName: 'web_vital',
        timestamp: { gte: since },
      },
      select: { properties: true, pageUrl: true, timestamp: true },
      take: 5000,
      orderBy: { timestamp: 'desc' },
    });

    const grouped = new Map<string, { total: number; count: number; poor: number }>();
    for (const event of events) {
      const metric = parseMetric(event.properties);
      if (!metric?.name || typeof metric.value !== 'number') continue;
      const key = metric.name.toLowerCase();
      const current = grouped.get(key) || { total: 0, count: 0, poor: 0 };
      current.total += metric.value;
      current.count += 1;
      if (metric.rating === 'poor') current.poor += 1;
      grouped.set(key, current);
    }

    const averageMetrics = Object.fromEntries(
      Array.from(grouped.entries()).map(([name, value]) => [name, value.count ? Math.round(value.total / value.count) : 0])
    );

    const issues = Array.from(grouped.entries())
      .filter(([, value]) => value.poor > 0)
      .map(([name, value]) => ({ type: name.toUpperCase(), count: value.poor, description: `${value.poor} poor ${name.toUpperCase()} measurements in the last 30 days` }));

    return NextResponse.json({
      averageMetrics: {
        lcp: averageMetrics.lcp || 0,
        inp: averageMetrics.inp || 0,
        cls: averageMetrics.cls || 0,
        fcp: averageMetrics.fcp || 0,
        ttfb: averageMetrics.ttfb || 0,
      },
      pageViews: new Set(events.map((event) => event.pageUrl).filter(Boolean)).size,
      issues,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error reading performance metrics:', error);
    return NextResponse.json({ error: 'Failed to load performance metrics' }, { status: 500 });
  }
}

function parseMetric(value: unknown): Partial<WebVitalsMetric> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Partial<WebVitalsMetric>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}