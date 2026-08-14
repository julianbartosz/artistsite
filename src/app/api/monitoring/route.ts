import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface DeploymentMetrics {
  environment: string;
  version: string;
  deployedAt: string;
  buildInfo: {
    commitSha: string;
    branch: string;
    buildTime: string;
  };
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
  infrastructure: {
    containerStatus: string;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sinceHour = new Date(oneHourAgo);
    const sinceDay = new Date(oneDayAgo);
    
    const [recentEvents, recentErrors, recentRequestMetrics, recentAlerts] = await Promise.all([
      db.analyticsEvent.count({ where: { timestamp: { gte: sinceHour } } }),
      db.analyticsEvent.count({
        where: {
          eventName: { in: ['monitoring_error', 'error_reported'] },
          timestamp: { gte: sinceHour },
        },
      }),
      db.analyticsEvent.findMany({
        where: {
          eventName: 'monitoring_request',
          timestamp: { gte: sinceHour },
        },
        select: { properties: true },
        take: 1000,
      }),
      db.analyticsEvent.findMany({
        where: {
          eventName: { in: ['monitoring_error', 'error_reported'] },
          timestamp: { gte: sinceDay },
        },
        orderBy: { timestamp: 'desc' },
        select: { properties: true, timestamp: true },
        take: 10,
      }),
    ]);
    
    const responseTimes = recentRequestMetrics
      .map((event) => parseProperties(event.properties).responseTime)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
      : 0;
    
    const requestsPerMinute = recentEvents / 60;
    const errorRate = recentEvents > 0 
      ? (recentErrors / recentEvents) * 100 
      : 0;

    // Get system info
    const memUsage = process.memoryUsage();
    
    const metrics: DeploymentMetrics = {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      deployedAt: process.env.DEPLOYMENT_TIME || new Date().toISOString(),
      buildInfo: {
        commitSha: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown',
        buildTime: process.env.BUILD_TIME || 'unknown',
      },
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
      },
      infrastructure: {
        containerStatus: 'running',
        memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        cpuUsage: Math.round(process.cpuUsage().system / 1000000), // Convert to percentage
        diskUsage: 0, // Would need additional monitoring for real disk usage
      },
      alerts: recentAlerts.map((event) => {
        const properties = parseProperties(event.properties);
        const severity = String(properties.severity || properties.level || 'error');
        return {
          level: ['info', 'warning', 'error', 'critical'].includes(severity) ? severity as any : 'error',
          message: String(properties.message || properties.error || 'Monitoring error recorded'),
          timestamp: new Date(event.timestamp).toISOString(),
        };
      }).reverse(),
    };

    if (metrics.performance.errorRate > 5) metrics.alerts.push({ level: 'warning', message: `High error rate detected: ${metrics.performance.errorRate}%`, timestamp: new Date().toISOString() });
    if (metrics.infrastructure.memoryUsage > 85) metrics.alerts.push({ level: 'critical', message: `High memory usage: ${metrics.infrastructure.memoryUsage}%`, timestamp: new Date().toISOString() });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Monitoring endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve monitoring data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type === 'error') {
      await db.analyticsEvent.create({
        data: {
          eventName: 'monitoring_error',
          pageUrl: body.path || body.url,
          properties: JSON.stringify({
            message: body.message || 'Unknown error',
            severity: body.severity || 'error',
            status: body.status,
          }),
          timestamp: new Date(),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid monitoring data' },
      { status: 400 }
    );
  }
}

function parseProperties(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}