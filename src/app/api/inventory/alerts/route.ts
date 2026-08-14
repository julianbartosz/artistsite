import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/inventory';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') || undefined;

    const alerts = await InventoryService.getActiveAlerts(severity);
    
    return NextResponse.json({
      success: true,
      alerts
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Stock alerts API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

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
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Alert updated successfully'
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Alert update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}