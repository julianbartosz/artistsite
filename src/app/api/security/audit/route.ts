// Security Audit API
import { NextRequest, NextResponse } from 'next/server';
import { SecurityAuditor, ProductionReadinessAuditor } from '@/lib/security/security-auditor';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const auditType = searchParams.get('type') || 'security';

    if (auditType === 'security') {
      const audit = await SecurityAuditor.runCompleteSecurityAudit();
      return NextResponse.json(audit);
    } else if (auditType === 'production') {
      const readiness = await ProductionReadinessAuditor.runProductionReadinessCheck();
      return NextResponse.json(readiness);
    } else {
      return NextResponse.json(
        { error: 'Invalid audit type. Use "security" or "production"' },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Error running security audit:', error);
    return NextResponse.json(
      { error: 'Failed to run security audit' },
      { status: 500 }
    );
  }
}
