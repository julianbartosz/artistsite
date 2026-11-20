import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';

export async function GET() {
  try {
    await requireAdmin();
    // Get the latest security audit results
    const latestAudit = await db.analyticsEvent.findFirst({
      where: {
        eventName: 'security_audit_completed'
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestAudit) {
      return NextResponse.json({
        overallScore: null,
        criticalIssues: null,
        lastAudit: null,
        recommendations: ['Run initial security audit']
      });
    }

    const auditData = JSON.parse(latestAudit.properties);
    
    return NextResponse.json({
      overallScore: typeof auditData.overall_score === 'number' ? auditData.overall_score : null,
      criticalIssues: typeof auditData.critical_issues === 'number' ? auditData.critical_issues : 0,
      lastAudit: latestAudit.timestamp.toISOString(),
      recommendations: Array.isArray(auditData.recommendations) ? auditData.recommendations : []
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Error fetching security status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security status' },
      { status: 500 }
    );
  }
}
