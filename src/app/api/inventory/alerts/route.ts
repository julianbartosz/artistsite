import { InventoryService } from '@/lib/inventory';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AlertSeverity } from '@domain/shop'

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const severityParam = searchParams.get('severity') || undefined;
    const allowed: AlertSeverity[] = ['low', 'medium', 'high', 'critical']
    const severity = (severityParam && allowed.includes(severityParam as AlertSeverity)
      ? (severityParam as AlertSeverity)
      : undefined)

    const alerts = await InventoryService.getActiveAlerts(severity);
    
    return json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Stock alerts API error:', error);
    return json(
      { success: false, error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, alertId } = body;

    switch (action) {
      case 'acknowledge':
        await InventoryService.acknowledgeAlert(alertId, session.user.id);
        break;

      case 'resolve':
        await InventoryService.resolveAlert(alertId);
        break;

      default:
        return json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return json({
      success: true,
      message: 'Alert updated successfully'
    });

  } catch (error) {
    console.error('Alert update error:', error);
    return json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}