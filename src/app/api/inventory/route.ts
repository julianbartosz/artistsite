import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/inventory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const productIds = searchParams.get('productIds')?.split(',');

    if (productId) {
      // Get single product inventory
      const inventory = await InventoryService.getInventoryStatus(productId);
      return NextResponse.json({
        success: true,
        inventory
      });
    } else if (productIds) {
      // Get bulk inventory status
      const inventories = await InventoryService.getBulkInventoryStatus(productIds);
      return NextResponse.json({
        success: true,
        inventories: Object.fromEntries(inventories)
      });
    } else {
      // Get dashboard data (admin only)
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const dashboardData = await InventoryService.getDashboardData();
      return NextResponse.json({
        success: true,
        ...dashboardData
      });
    }
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get inventory data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, productId, quantity, type, reason, notes } = body;

    switch (action) {
      case 'initialize':
        await InventoryService.initializeInventory(
          productId,
          quantity || 0,
          body.lowStockThreshold || 5,
          body.allowBackorders || false
        );
        break;

      case 'adjust':
        await InventoryService.recordStockMovement({
          productId,
          type: type || 'adjustment',
          quantity,
          userId: session.user.id,
          reason,
          notes
        });
        break;

      case 'reserve':
        const reservationId = await InventoryService.reserveStock(
          productId,
          quantity,
          body.expirationMinutes || 15,
          {
            userId: session.user.id,
            orderId: body.orderId,
            cartSessionId: body.cartSessionId
          }
        );
        return NextResponse.json({
          success: true,
          reservationId
        });

      case 'release':
        await InventoryService.releaseReservation(body.reservationId);
        break;

      case 'fulfill':
        await InventoryService.fulfillReservation(body.reservationId, body.orderId);
        break;

      case 'bulk_update':
        await InventoryService.bulkUpdateInventory(body.updates, session.user.id);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory updated successfully'
    });

  } catch (error) {
    console.error('Inventory update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}