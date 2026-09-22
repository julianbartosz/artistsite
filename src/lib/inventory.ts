import { prisma } from '@/lib/db';
import { getAllProducts } from './commerce-server';

export interface InventoryStatus {
  productId: string;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  lowStockThreshold: number;
  allowBackorders: boolean;
}

export type PublicInventoryStatus = Pick<InventoryStatus, 'productId' | 'availableStock' | 'stockStatus' | 'allowBackorders'>;

export interface StockMovementData {
  productId: string;
  type: 'restock' | 'sale' | 'adjustment' | 'return' | 'damaged' | 'transfer';
  quantity: number;
  reason?: string;
  notes?: string;
  orderId?: string;
  userId?: string;
  cost?: number;
  supplier?: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  type: 'low_stock' | 'out_of_stock' | 'reorder_point' | 'overstock';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentStock: number;
  thresholdValue?: number;
  isActive: boolean;
  createdAt: Date;
}

export class InventoryService {
  /**
   * Initialize inventory tracking for a product
   */
  static async initializeInventory(
    productId: string,
    initialStock: number = 0,
    lowStockThreshold: number = 5,
    allowBackorders: boolean = false
  ): Promise<void> {
    // Start at zero so recordStockMovement is the sole writer of stock levels.
    await prisma.productInventory.create({
      data: {
        productId,
        currentStock: 0,
        availableStock: 0,
        lowStockThreshold,
        allowBackorders,
        stockStatus: this.calculateStockStatus(0, lowStockThreshold),
        isTrackingEnabled: true
      }
    });

    if (initialStock > 0) {
      await this.recordStockMovement({
        productId,
        type: 'restock',
        quantity: initialStock,
        reason: 'Initial inventory setup'
      });
    }
  }

  /**
   * Get inventory status for a product
   */
  static async getInventoryStatus(productId: string): Promise<InventoryStatus | null> {
    const inventory = await prisma.productInventory.findUnique({
      where: { productId }
    });

    if (!inventory) return null;

    return {
      productId: inventory.productId,
      currentStock: inventory.currentStock,
      availableStock: inventory.availableStock,
      reservedStock: inventory.reservedStock,
      stockStatus: inventory.stockStatus as any,
      lowStockThreshold: inventory.lowStockThreshold,
      allowBackorders: inventory.allowBackorders
    };
  }

  /**
   * Get public-safe inventory status for storefront availability display.
   */
  static async getPublicInventoryStatus(productId: string): Promise<PublicInventoryStatus | null> {
    const inventory = await this.getInventoryStatus(productId);
    if (!inventory) return null;

    return {
      productId: inventory.productId,
      availableStock: inventory.availableStock,
      stockStatus: inventory.stockStatus,
      allowBackorders: inventory.allowBackorders,
    };
  }

  /**
   * Get inventory status for multiple products
   */
  static async getBulkInventoryStatus(productIds: string[]): Promise<Map<string, InventoryStatus>> {
    const inventories = await prisma.productInventory.findMany({
      where: { productId: { in: productIds } }
    });

    const statusMap = new Map<string, InventoryStatus>();
    
    inventories.forEach(inventory => {
      statusMap.set(inventory.productId, {
        productId: inventory.productId,
        currentStock: inventory.currentStock,
        availableStock: inventory.availableStock,
        reservedStock: inventory.reservedStock,
        stockStatus: inventory.stockStatus as any,
        lowStockThreshold: inventory.lowStockThreshold,
        allowBackorders: inventory.allowBackorders
      });
    });

    return statusMap;
  }

  /**
   * Purchasability when inventory tracking is optional (no row = unlimited originals).
   */
  static isPurchasableFromStatus(
    availability: string,
    inventory: InventoryStatus | null | undefined,
    quantity: number = 1,
  ): boolean {
    if (availability !== 'available') return false;
    if (!inventory) return true;
    if (inventory.stockStatus === 'discontinued') return false;
    if (inventory.allowBackorders) return true;
    return inventory.availableStock >= quantity;
  }

  static async isPurchasable(productId: string, availability: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.getInventoryStatus(productId);
    return this.isPurchasableFromStatus(availability, inventory, quantity);
  }

  /**
   * Check if product is available for purchase (inventory row required).
   */
  static async isProductAvailable(productId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.getInventoryStatus(productId);
    if (!inventory) return false;
    return this.isPurchasableFromStatus('available', inventory, quantity);
  }

  /**
   * Reserve stock for checkout process (atomic claim on availableStock).
   */
  static async reserveStock(
    productId: string,
    quantity: number,
    expirationMinutes: number = 15,
    options: {
      orderId?: string;
      cartSessionId?: string;
      userId?: string;
    } = {}
  ): Promise<string | null> {
    if (!Number.isInteger(quantity) || quantity < 1) return null;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    const reservationId = await prisma.$transaction(async (tx) => {
      const inventory = await tx.productInventory.findUnique({
        where: { productId },
      });
      if (!inventory) return null;

      const claimed = await tx.productInventory.updateMany({
        where: inventory.allowBackorders
          ? { id: inventory.id }
          : { id: inventory.id, availableStock: { gte: quantity } },
        data: {
          reservedStock: { increment: quantity },
          availableStock: { decrement: quantity },
        },
      });
      if (claimed.count === 0) return null;

      const reservation = await tx.stockReservation.create({
        data: {
          productId,
          inventoryId: inventory.id,
          quantity,
          expiresAt,
          orderId: options.orderId,
          cartSessionId: options.cartSessionId,
          userId: options.userId,
        },
      });
      return reservation.id;
    });

    if (reservationId) {
      await this.updateStockStatus(productId);
    }
    return reservationId;
  }

  /**
   * Release stock reservation (CAS on active status).
   */
  static async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await prisma.stockReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.status !== 'active') return;

    const claimed = await prisma.stockReservation.updateMany({
      where: { id: reservationId, status: 'active' },
      data: { status: 'cancelled' },
    });
    if (claimed.count === 0) return;

    await prisma.productInventory.updateMany({
      where: {
        id: reservation.inventoryId,
        reservedStock: { gte: reservation.quantity },
      },
      data: {
        reservedStock: { decrement: reservation.quantity },
        availableStock: { increment: reservation.quantity },
      },
    });

    await this.updateStockStatus(reservation.productId);
  }

  /**
   * Release expired checkout reservations so abandoned carts cannot hold stock forever.
   */
  static async releaseExpiredReservations(now: Date = new Date()): Promise<number> {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: now },
      },
      select: { id: true },
      take: 100,
    });

    for (const reservation of reservations) {
      await this.releaseReservation(reservation.id);
    }

    return reservations.length;
  }

  /**
   * Fulfill stock reservation (convert to sale).
   * reservedStock is released here; current/available stock change only via recordStockMovement.
   */
  static async fulfillReservation(reservationId: string, orderId?: string): Promise<void> {
    const reservation = await prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { inventory: true }
    });

    if (!reservation || reservation.status !== 'active') return;

    const claimed = await prisma.stockReservation.updateMany({
      where: { id: reservationId, status: 'active' },
      data: {
        status: 'fulfilled',
        fulfilledAt: new Date(),
        orderId: orderId || reservation.orderId
      }
    });
    if (claimed.count === 0) return;

    // Release the hold before the sale movement so availableStock = current - reserved stays correct.
    await prisma.productInventory.updateMany({
      where: {
        id: reservation.inventoryId,
        reservedStock: { gte: reservation.quantity },
      },
      data: {
        reservedStock: { decrement: reservation.quantity },
        lastSold: new Date(),
      },
    });

    await this.recordStockMovement({
      productId: reservation.productId,
      type: 'sale',
      quantity: -reservation.quantity,
      orderId: orderId || reservation.orderId || undefined,
      reason: 'Order fulfillment'
    });
  }

  /**
   * Release every active reservation for an order (checkout/session failure cleanup).
   */
  static async releaseActiveReservationsForOrder(orderId: string): Promise<void> {
    const reservations = await prisma.stockReservation.findMany({
      where: { orderId, status: 'active' },
      select: { id: true },
    });
    for (const reservation of reservations) {
      await this.releaseReservation(reservation.id);
    }
  }

  /**
   * Fulfill every active reservation tied to an order after confirmed payment.
   */
  static async fulfillReservationsForOrder(orderId: string): Promise<void> {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        orderId,
        status: 'active'
      }
    });

    for (const reservation of reservations) {
      await this.fulfillReservation(reservation.id, orderId);
    }
  }

  /**
   * After payment: fulfill active holds, then sell any tracked shortfall
   * (e.g. reservation expired/released before webhook arrived).
   */
  static async settlePaidOrderStock(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    await this.fulfillReservationsForOrder(orderId);

    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) continue;

      const inventory = await prisma.productInventory.findUnique({
        where: { productId: item.productId },
        select: { id: true },
      });
      if (!inventory) continue;

      const covered = await prisma.stockReservation.aggregate({
        where: {
          orderId,
          productId: item.productId,
          status: 'fulfilled',
        },
        _sum: { quantity: true },
      });
      const coveredQty = covered._sum.quantity ?? 0;
      const shortfall = item.quantity - coveredQty;
      if (shortfall <= 0) continue;

      await this.recordStockMovement({
        productId: item.productId,
        type: 'sale',
        quantity: -shortfall,
        orderId,
        reason: 'Paid order stock settlement without active reservation',
      });
    }
  }

  /**
   * Restore inventory after a refund.
   * Stock levels change only via recordStockMovement (no second apply).
   */
  static async releaseStockForOrder(orderId: string): Promise<void> {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        orderId,
        status: 'fulfilled',
      },
    });

    for (const reservation of reservations) {
      const claimed = await prisma.stockReservation.updateMany({
        where: { id: reservation.id, status: 'fulfilled' },
        data: { status: 'cancelled' },
      });
      if (claimed.count === 0) continue;

      await this.recordStockMovement({
        productId: reservation.productId,
        type: 'return',
        quantity: reservation.quantity,
        orderId,
        reason: 'Order refunded',
      });
    }
  }

  /**
   * Record stock movement with optimistic CAS on current/reserved levels.
   */
  static async recordStockMovement(data: StockMovementData, maxAttempts: number = 5): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const inventory = await prisma.productInventory.findUnique({
        where: { productId: data.productId },
      });

      if (!inventory) {
        throw new Error(`Inventory not found for product ${data.productId}`);
      }

      const previousStock = inventory.currentStock;
      const newStock = previousStock + data.quantity;

      const applied = await prisma.$transaction(async (tx) => {
        const updated = await tx.productInventory.updateMany({
          where: {
            id: inventory.id,
            currentStock: previousStock,
            reservedStock: inventory.reservedStock,
          },
          data: {
            currentStock: newStock,
            availableStock: Math.max(0, newStock - inventory.reservedStock),
            ...(data.type === 'restock' ? { lastRestocked: new Date() } : {}),
          },
        });
        if (updated.count === 0) return false;

        await tx.stockMovement.create({
          data: {
            productId: data.productId,
            inventoryId: inventory.id,
            type: data.type,
            quantity: data.quantity,
            previousStock,
            newStock,
            orderId: data.orderId,
            userId: data.userId,
            reason: data.reason,
            notes: data.notes,
            cost: data.cost,
            supplier: data.supplier,
          },
        });
        return true;
      });

      if (applied) {
        await this.updateStockStatus(data.productId);
        return;
      }
    }

    throw new Error(`Concurrent stock update failed for product ${data.productId}`);
  }

  /**
   * Update stock status based on current levels
   */
  static async updateStockStatus(productId: string): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({
      where: { productId }
    });

    if (!inventory) return;

    const newStatus = this.calculateStockStatus(
      inventory.availableStock,
      inventory.lowStockThreshold
    );

    if (newStatus !== inventory.stockStatus) {
      await prisma.productInventory.update({
        where: { id: inventory.id },
        data: { stockStatus: newStatus }
      });

      // Create alert if needed
      await this.checkAndCreateAlerts(productId, inventory.availableStock, newStatus);
    }
  }

  /**
   * Calculate stock status based on available stock and threshold
   */
  private static calculateStockStatus(
    availableStock: number,
    lowStockThreshold: number
  ): string {
    if (availableStock === 0) return 'out_of_stock';
    if (availableStock <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
  }

  /**
   * Check and create stock alerts
   */
  private static async checkAndCreateAlerts(
    productId: string,
    currentStock: number,
    stockStatus: string
  ): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({
      where: { productId }
    });

    if (!inventory) return;

    // Check if alert already exists and is active
    const existingAlert = await prisma.stockAlert.findFirst({
      where: {
        productId,
        type: stockStatus === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
        isActive: true
      }
    });

    if (existingAlert) return;

    // Create new alert
    let alertType: string;
    let severity: string;
    let message: string;

    if (stockStatus === 'out_of_stock') {
      alertType = 'out_of_stock';
      severity = 'critical';
      message = `Product is out of stock`;
    } else if (stockStatus === 'low_stock') {
      alertType = 'low_stock';
      severity = 'medium';
      message = `Product stock is low (${currentStock} remaining)`;
    } else {
      return; // No alert needed
    }

    await prisma.stockAlert.create({
      data: {
        productId,
        type: alertType,
        severity,
        message,
        currentStock,
        thresholdValue: inventory.lowStockThreshold
      }
    });
  }

  /**
   * Get active stock alerts
   */
  static async getActiveAlerts(severity?: string): Promise<StockAlert[]> {
    const where: any = { isActive: true };
    if (severity) {
      where.severity = severity;
    }

    const alerts = await prisma.stockAlert.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return alerts.map(alert => ({
      id: alert.id,
      productId: alert.productId,
      type: alert.type as any,
      severity: alert.severity as any,
      message: alert.message,
      currentStock: alert.currentStock,
      thresholdValue: alert.thresholdValue || undefined,
      isActive: alert.isActive,
      createdAt: alert.createdAt
    }));
  }

  /**
   * Acknowledge stock alert
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      }
    });
  }

  /**
   * Resolve stock alert
   */
  static async resolveAlert(alertId: string): Promise<void> {
    await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isActive: false,
        resolvedAt: new Date()
      }
    });
  }

  /**
   * Get stock movement history
   */
  static async getStockHistory(
    productId: string,
    limit: number = 50
  ): Promise<any[]> {
    return await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Clean up expired reservations via the CAS release path only.
   */
  static async cleanupExpiredReservations(): Promise<number> {
    return this.releaseExpiredReservations();
  }

  /**
   * Bulk update inventory levels (for admin use)
   */
  static async bulkUpdateInventory(
    updates: Array<{
      productId: string;
      currentStock: number;
      lowStockThreshold?: number;
      allowBackorders?: boolean;
    }>,
    userId: string
  ): Promise<void> {
    for (const update of updates) {
      const inventory = await prisma.productInventory.findUnique({
        where: { productId: update.productId }
      });

      if (!inventory) {
        await this.initializeInventory(
          update.productId,
          update.currentStock,
          update.lowStockThreshold,
          update.allowBackorders
        );
        continue;
      }

      const stockDifference = update.currentStock - inventory.currentStock;
      
      if (stockDifference !== 0) {
        await this.recordStockMovement({
          productId: update.productId,
          type: 'adjustment',
          quantity: stockDifference,
          userId,
          reason: 'Bulk inventory update'
        });
      }

      // Update settings if provided
      const updateData: any = {};
      if (update.lowStockThreshold !== undefined) {
        updateData.lowStockThreshold = update.lowStockThreshold;
      }
      if (update.allowBackorders !== undefined) {
        updateData.allowBackorders = update.allowBackorders;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.productInventory.update({
          where: { productId: update.productId },
          data: updateData
        });
      }
    }
  }

  /**
   * Get inventory dashboard data
   */
  static async getDashboardData(): Promise<{
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
    activeAlerts: number;
    recentMovements: any[];
  }> {
    const [
      inventories,
      alerts,
      recentMovements
    ] = await Promise.all([
      prisma.productInventory.findMany(),
      prisma.stockAlert.count({ where: { isActive: true } }),
      prisma.stockMovement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          inventory: {
            select: { productId: true }
          }
        }
      })
    ]);

    const products = await getAllProducts();
    const productMap = new Map(products.map(p => [p.id, p]));

    let totalValue = 0;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    inventories.forEach(inv => {
      const product = productMap.get(inv.productId);
      if (product) {
        totalValue += inv.currentStock * product.price;
      }

      switch (inv.stockStatus) {
        case 'in_stock':
          inStock++;
          break;
        case 'low_stock':
          lowStock++;
          break;
        case 'out_of_stock':
          outOfStock++;
          break;
      }
    });

    return {
      totalProducts: inventories.length,
      inStock,
      lowStock,
      outOfStock,
      totalValue,
      activeAlerts: alerts,
      recentMovements
    };
  }
}