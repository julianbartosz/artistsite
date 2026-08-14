// Performance Analytics API
import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor } from '@/lib/performance/performance-monitor';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const performanceData = await request.json();
    
    // In development, just log the performance data
    if (process.env.NODE_ENV === 'development') {
      console.log('⚡ Performance Data received:', {
        url: performanceData.url || performanceData.pathname,
        loadTime: performanceData.loadTime,
        webVitals: {
          lcp: performanceData.largestContentfulPaint,
          cls: performanceData.cumulativeLayoutShift,
          fcp: performanceData.firstContentfulPaint,
          ttfb: performanceData.timeToFirstByte
        },
        deviceType: performanceData.deviceType,
        connectionType: performanceData.connectionType,
        timestamp: performanceData.timestamp
      });
    }
    
    await db.analyticsEvent.create({
      data: {
        eventName: 'performance_metrics',
        properties: JSON.stringify(performanceData),
        timestamp: performanceData.timestamp ? new Date(performanceData.timestamp) : new Date(),
        pageUrl: performanceData.url || performanceData.pathname,
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing performance data:', error);
    return NextResponse.json(
      { error: 'Failed to process performance data' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const recommendations = await PerformanceMonitor.getOptimizationRecommendations();
    
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}