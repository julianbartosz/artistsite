import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get recent performance metrics from the last 24 hours
    const recentMetrics = await db.analyticsEvent.findMany({
      where: {
        eventName: 'performance_metrics',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 100
    });

    if (recentMetrics.length === 0) {
      return NextResponse.json({
        averageResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        p95ResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      });
    }

    // Calculate aggregated metrics
    const metrics = recentMetrics.map(m => JSON.parse(m.properties));
    const avgResponseTime = metrics.reduce((sum, m) => sum + (m.pageLoadTime || 0), 0) / metrics.length;
    const totalRequests = metrics.length;
    const timeSpan = 24; // hours
    const requestsPerSecond = totalRequests / (timeSpan * 3600);
    
    const recentErrors = await db.analyticsEvent.count({
      where: {
        eventName: 'error_reported',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    const errorRate = totalRequests > 0 ? (recentErrors / totalRequests) * 100 : 0;
    
    // Calculate P95 response time
    const responseTimes = metrics.map(m => m.pageLoadTime || 0).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB

    return NextResponse.json({
      averageResponseTime: Math.round(avgResponseTime),
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime),
      memoryUsage: Math.round(memoryUsage),
      cpuUsage: null
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Run a quick performance test
    const startTime = Date.now();
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const responseTime = Date.now() - startTime;
    
    // Store the test result
    await db.analyticsEvent.create({
      data: {
        eventName: 'performance_test',
        properties: JSON.stringify({
          responseTime,
          timestamp: new Date().toISOString()
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      responseTime,
      message: 'Performance test completed'
    });
  } catch (error) {
    console.error('Error running performance test:', error);
    return NextResponse.json(
      { error: 'Failed to run performance test' },
      { status: 500 }
    );
  }
}