// Security Audit API
import { SecurityAuditor, ProductionReadinessAuditor } from '@domain/security';

// Standard JSON helper
function json<T>(data: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auditType = searchParams.get('type') || 'security';

    if (auditType === 'security') {
      const audit = await SecurityAuditor.runCompleteSecurityAudit();
      return json(audit);
    } else if (auditType === 'production') {
      const readiness = await ProductionReadinessAuditor.runProductionReadinessCheck();
      return json(readiness);
    } else {
      return json(
        { error: 'Invalid audit type. Use "security" or "production"' },
        { status: 400 }
      );
    }
  } catch {
    return json(
      { error: 'Failed to run security audit' },
      { status: 500 }
    );
  }
}