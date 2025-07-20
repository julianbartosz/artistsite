import { NextRequest, NextResponse } from 'next/server';

interface PerformanceData {
  webVitals: {
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    lcp: number | null;
    ttfb: number | null;
  };
  loadTime: number;
  domContentLoaded: number;
  resourceCount: number;
  url: string;
  userAgent: string;
  connection: string;
  timestamp: number;
}

// In-memory storage for demo - replace with database in production
const performanceData: PerformanceData[] = [];

export async function POST(request: NextRequest) {
  try {
    const data: PerformanceData = await request.json();
    
    // Validate data
    if (!data.url || !data.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store performance data
    performanceData.push({
      ...data,
      timestamp: Date.now(), // Override with server timestamp
    });

    // Keep only recent data (last 1000 entries)
    if (performanceData.length > 1000) {
      performanceData.splice(0, performanceData.length - 1000);
    }

    // In production, you would:
    // 1. Store in database (e.g., ClickHouse, BigQuery)
    // 2. Send to analytics service (e.g., Google Analytics, DataDog)
    // 3. Trigger alerts for poor performance

    return NextResponse.json({ 
      success: true,
      message: 'Performance data recorded'
    });

  } catch (error) {
    console.error('Performance analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to record performance data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);

    // Filter data by URL if provided
    let filteredData = performanceData;
    if (url) {
      filteredData = performanceData.filter(d => d.url === url);
    }

    // Get recent data
    const recentData = filteredData
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    // Calculate averages
    const avgMetrics = {
      lcp: calculateAverage(recentData, 'webVitals.lcp'),
      inp: calculateAverage(recentData, 'webVitals.inp'),
      cls: calculateAverage(recentData, 'webVitals.cls'),
      fcp: calculateAverage(recentData, 'webVitals.fcp'),
      ttfb: calculateAverage(recentData, 'webVitals.ttfb'),
      loadTime: calculateAverage(recentData, 'loadTime'),
    };

    return NextResponse.json({
      data: recentData,
      averages: avgMetrics,
      count: recentData.length,
      totalRecords: performanceData.length
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60', // 1 minute cache
      },
    });

  } catch (error) {
    console.error('Performance analytics fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}

function calculateAverage(data: PerformanceData[], path: string): number | null {
  const values = data
    .map(item => getNestedValue(item, path))
    .filter(value => value !== null && !isNaN(value));
  
  if (values.length === 0) return null;
  
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getNestedValue(obj: any, path: string): number | null {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined || value === null) return null;
  }
  
  return typeof value === 'number' ? value : null;
}