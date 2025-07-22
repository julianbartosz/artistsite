import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Check database health
    let databaseStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    try {
      await db.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'error';
    }

    // Check API response time
    const apiResponseTime = Date.now() - startTime;
    let apiStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    if (apiResponseTime > 1000) {
      apiStatus = 'error';
    } else if (apiResponseTime > 500) {
      apiStatus = 'warning';
    }

    // Mock cache status (would integrate with actual cache system)
    const cacheStatus: 'healthy' | 'warning' | 'error' = 'healthy';

    // Calculate uptime (simplified - would use actual process uptime)
    const uptimeMs = process.uptime() * 1000;
    const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const uptimeHours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const uptime = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;

    return NextResponse.json({
      database: databaseStatus,
      api: apiStatus,
      cache: cacheStatus,
      uptime
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    return NextResponse.json(
      { error: 'Failed to check system health' },
      { status: 500 }
    );
  }
}