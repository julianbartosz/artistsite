// Performance Analytics API
import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor } from '@/lib/performance/performance-monitor';

export async function POST(request: NextRequest) {
  try {
    const metrics = await request.json();
    await PerformanceMonitor.recordMetrics(metrics);
    
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