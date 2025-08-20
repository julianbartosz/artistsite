import { InventoryService } from '@/lib/inventory';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const productIds = searchParams.get('productIds')?.split(',');

    if (productId) {
      const inventory = await InventoryService.getInventoryStatus(productId);
      return json({ success: true, inventory });
    } else if (productIds) {
      const inventories = await InventoryService.getBulkInventoryStatus(productIds);
      return json({ success: true, inventories: Object.fromEntries(inventories) });
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

      const dashboardData = await InventoryService.getDashboardData();
      return json({ success: true, ...dashboardData });
    }
  } catch (error) {
    console.error('Inventory API error:', error);
    return json({ success: false, error: 'Failed to get inventory data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

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

      case 'reserve': {
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
        return json({ success: true, reservationId });
      }

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
        return json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    return json({ success: true, message: 'Inventory updated successfully' });
  } catch (error) {
    console.error('Inventory update error:', error);
    return json({ success: false, error: 'Failed to update inventory' }, { status: 500 });
  }
}