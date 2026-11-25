import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db';
import { getConfig, setConfig } from '@/lib/config';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  type LowStockThresholdConfig,
  parseLowStockThresholds,
  resolveLowStockThreshold,
  sanitizeLowStockThresholds,
} from '@/lib/commerce';
import { getAllProducts } from './commerce-server';

const LOW_STOCK_THRESHOLDS_KEY = 'INVENTORY_LOW_STOCK_THRESHOLDS';

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
    lowStockThreshold?: number,
    allowBackorders: boolean = false
  ): Promise<void> {
    let resolvedThreshold = lowStockThreshold;
    if (resolvedThreshold === undefined) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { category: true },
      });
      resolvedThreshold = product
        ? await this.getThresholdForCategory(product.category)
        : DEFAULT_LOW_STOCK_THRESHOLD;
    }

    // Start at zero so recordStockMovement is the sole writer of stock levels.
    await prisma.productInventory.create({
      data: {
        productId,
        currentStock: 0,
        availableStock: 0,
        lowStockThreshold: resolvedThreshold,
        allowBackorders,
        stockStatus: this.calculateStockStatus(0, resolvedThreshold),
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
    } else {
      // Zero starting stock still syncs catalog availability (sold when empty).
      await this.updateStockStatus(productId);
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
   * Batched public-safe inventory lookup for storefront listing pages (eliminates N+1 /api/inventory calls).
   */
  static async getBulkPublicInventoryStatus(
    productIds: string[],
  ): Promise<Record<string, PublicInventoryStatus>> {
    if (productIds.length === 0) return {};
    const statusMap = await this.getBulkInventoryStatus(productIds);
    const result: Record<string, PublicInventoryStatus> = {};
    for (const [productId, inventory] of statusMap.entries()) {
      result[productId] = {
        productId: inventory.productId,
        availableStock: inventory.availableStock,
        stockStatus: inventory.stockStatus,
        allowBackorders: inventory.allowBackorders,
      };
    }
    return result;
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
      if (!inventory) {
        // Untracked listings (often one-of-ones): sale removes them from the shop.
        await prisma.product.updateMany({
          where: { id: item.productId, availability: 'available' },
          data: { availability: 'sold' },
        });
        continue;
      }

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
   * Also restores shortfall sales (settle without reservation) and untracked sold listings.
   */
  static async releaseStockForOrder(
    orderId: string,
    items: Array<{ productId: string; quantity: number }> = [],
  ): Promise<void> {
    const restoredByProduct = new Map<string, number>();

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
      restoredByProduct.set(
        reservation.productId,
        (restoredByProduct.get(reservation.productId) ?? 0) + reservation.quantity,
      );
    }

    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) continue;

      const inventory = await prisma.productInventory.findUnique({
        where: { productId: item.productId },
        select: { id: true },
      });

      if (!inventory) {
        await prisma.product.updateMany({
          where: { id: item.productId, availability: 'sold' },
          data: { availability: 'available' },
        });
        revalidateTag('products');
        continue;
      }

      const alreadyRestored = restoredByProduct.get(item.productId) ?? 0;
      const shortfall = item.quantity - alreadyRestored;
      if (shortfall <= 0) continue;

      await this.recordStockMovement({
        productId: item.productId,
        type: 'return',
        quantity: shortfall,
        orderId,
        reason: 'Order refunded — restore settlement without reservation',
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
   * Update stock status and synchronize active stock alerts with current levels.
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
    }

    // Always reconcile alerts so restocks auto-resolve stale alerts and count changes stay accurate.
    await this.syncProductAlerts(
      productId,
      inventory.availableStock,
      inventory.lowStockThreshold,
      newStatus,
    );

    // Keep catalog availability in sync with tracked stock so sold-out
    // originals leave the shop without a manual availability edit.
    // Backorderable items stay listed when empty; reserved holds (available 0,
    // current > 0) still hide the listing until the hold releases or settles.
    let catalogChanged = false;
    if (inventory.availableStock <= 0 && !inventory.allowBackorders) {
      const updated = await prisma.product.updateMany({
        where: { id: productId, availability: 'available' },
        data: { availability: 'sold' },
      });
      catalogChanged = updated.count > 0;
    } else if (inventory.availableStock > 0) {
      const updated = await prisma.product.updateMany({
        where: { id: productId, availability: 'sold' },
        data: { availability: 'available' },
      });
      catalogChanged = updated.count > 0;
    }

    if (catalogChanged) {
      revalidateTag('products');
    }
  }

  /**
   * Calculate stock status based on available stock and threshold.
   * A threshold of 0 disables low-stock warnings (useful for 1-of-1 originals)
   * so stock moves directly from in_stock to out_of_stock at 0.
   */
  private static calculateStockStatus(
    availableStock: number,
    lowStockThreshold: number
  ): string {
    if (availableStock <= 0) return 'out_of_stock';
    if (lowStockThreshold > 0 && availableStock <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
  }

  /**
   * Keep active stock alerts strictly in sync with a product's current stock status:
   * - Auto-resolve all active alerts when back in stock (or discontinued).
   * - Auto-resolve alerts of superseded types (e.g. out_of_stock -> low_stock).
   * - Update existing matching alert counts/messages in place without re-emailing.
   * - Create and email a new alert only when newly entering an alert state.
   */
  static async syncProductAlerts(
    productId: string,
    availableStock: number,
    lowStockThreshold: number,
    stockStatus: string,
    options: { sendEmail?: boolean } = {},
  ): Promise<void> {
    const now = new Date();
    const target =
      stockStatus === 'out_of_stock'
        ? {
            type: 'out_of_stock' as const,
            severity: 'critical' as const,
            message: 'Product is out of stock',
          }
        : stockStatus === 'low_stock'
          ? {
              type: 'low_stock' as const,
              severity: 'medium' as const,
              message: `Product stock is low (${availableStock} remaining)`,
            }
          : null;

    if (!target) {
      await prisma.stockAlert.updateMany({
        where: { productId, isActive: true },
        data: { isActive: false, resolvedAt: now },
      });
      return;
    }

    // Resolve any active alerts of a different type (e.g. out_of_stock when now low_stock).
    await prisma.stockAlert.updateMany({
      where: {
        productId,
        isActive: true,
        type: { not: target.type },
      },
      data: { isActive: false, resolvedAt: now },
    });

    const matchingAlerts = await prisma.stockAlert.findMany({
      where: { productId, type: target.type, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (matchingAlerts.length > 0) {
      const [primary, ...duplicates] = matchingAlerts;
      if (
        primary.currentStock !== availableStock ||
        primary.thresholdValue !== lowStockThreshold ||
        primary.message !== target.message ||
        primary.severity !== target.severity
      ) {
        await prisma.stockAlert.update({
          where: { id: primary.id },
          data: {
            currentStock: availableStock,
            thresholdValue: lowStockThreshold,
            message: target.message,
            severity: target.severity,
          },
        });
      }
      if (duplicates.length > 0) {
        await prisma.stockAlert.updateMany({
          where: { id: { in: duplicates.map((entry) => entry.id) } },
          data: { isActive: false, resolvedAt: now },
        });
      }
      return;
    }

    await prisma.stockAlert.create({
      data: {
        productId,
        type: target.type,
        severity: target.severity,
        message: target.message,
        currentStock: availableStock,
        thresholdValue: lowStockThreshold,
      },
    });

    if (options.sendEmail === false) return;

    try {
      const [{ brandedEmailHtml, getEmailBrand, sendTemplateEmail }, { escapeHtml }, { getConfig }, { absoluteUrl }] = await Promise.all([
        import('@/lib/email'),
        import('@/lib/email-shell'),
        import('@/lib/config'),
        import('@/lib/utils'),
      ]);
      const recipient =
        (await getConfig('ARTIST_EMAIL'))
        || (await getConfig('CONTACT_EMAIL'))
        || (await getConfig('SUPPORT_EMAIL'));
      if (!recipient) return;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { title: true },
      });
      const title = product?.title || productId;
      const subject = target.type === 'out_of_stock'
        ? `Out of stock: ${title}`
        : `Low stock: ${title}`;
      const detail = target.type === 'out_of_stock'
        ? `"${title}" is out of stock.`
        : `"${title}" is low (${availableStock} remaining).`;
      const brand = await getEmailBrand();
      const inventoryUrl = absoluteUrl('/admin?tab=inventory', brand.siteUrl);
      await sendTemplateEmail(recipient, {
        subject,
        html: brandedEmailHtml(brand, {
          title: subject,
          intro: escapeHtml(detail),
          cta: { label: 'Review inventory', href: inventoryUrl },
        }),
        text: `${detail}\n\nReview inventory: ${inventoryUrl}`,
      });
    } catch (alertEmailError) {
      console.error('Failed to email stock alert:', alertEmailError);
    }
  }

  /**
   * Get active stock alerts (self-heals any legacy drifted alerts whose inventory moved).
   */
  static async getActiveAlerts(severity?: string): Promise<StockAlert[]> {
    const rawAlerts = await prisma.stockAlert.findMany({
      where: { isActive: true },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (rawAlerts.length > 0) {
      const alertProductIds = [...new Set(rawAlerts.map((alert) => alert.productId))];
      const inventories = await prisma.productInventory.findMany({
        where: { productId: { in: alertProductIds } },
      });
      const invByProduct = new Map(inventories.map((inv) => [inv.productId, inv]));

      let reconciledAny = false;
      const seenByProduct = new Map<string, number>();
      for (const alert of rawAlerts) {
        seenByProduct.set(alert.productId, (seenByProduct.get(alert.productId) ?? 0) + 1);
      }

      for (const productId of alertProductIds) {
        const inv = invByProduct.get(productId);
        if (!inv) {
          await prisma.stockAlert.updateMany({
            where: { productId, isActive: true },
            data: { isActive: false, resolvedAt: new Date() },
          });
          reconciledAny = true;
          continue;
        }
        const computedStatus = this.calculateStockStatus(inv.availableStock, inv.lowStockThreshold);
        const productAlerts = rawAlerts.filter((entry) => entry.productId === productId);
        const expectedType = computedStatus === 'out_of_stock'
          ? 'out_of_stock'
          : computedStatus === 'low_stock'
            ? 'low_stock'
            : null;
        const needsSync =
          (seenByProduct.get(productId) ?? 0) > 1
          || expectedType === null
          || productAlerts.some(
            (entry) => entry.type !== expectedType || entry.currentStock !== inv.availableStock,
          );
        if (needsSync) {
          await this.syncProductAlerts(
            productId,
            inv.availableStock,
            inv.lowStockThreshold,
            computedStatus,
            { sendEmail: false },
          );
          reconciledAny = true;
        }
      }

      if (reconciledAny) {
        const refreshed = await prisma.stockAlert.findMany({
          where: severity ? { isActive: true, severity } : { isActive: true },
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' }
          ]
        });
        return refreshed.map(alert => ({
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
    }

    const filtered = severity ? rawAlerts.filter((alert) => alert.severity === severity) : rawAlerts;
    return filtered.map(alert => ({
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
   * Resolve all active stock alerts (optionally scoped to a single alert type).
   */
  static async resolveAllAlerts(type?: 'low_stock' | 'out_of_stock'): Promise<number> {
    const result = await prisma.stockAlert.updateMany({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
      },
      data: {
        isActive: false,
        resolvedAt: new Date(),
      },
    });
    return result.count;
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
        await this.updateStockStatus(update.productId);
      } else if (stockDifference === 0) {
        // Ensure status/alerts stay reconciled even if caller re-saves current stock.
        await this.updateStockStatus(update.productId);
      }
    }
  }

  /**
   * Read per-category low-stock threshold settings.
   */
  static async getLowStockThresholds(): Promise<LowStockThresholdConfig> {
    const raw = await getConfig(LOW_STOCK_THRESHOLDS_KEY);
    return parseLowStockThresholds(raw);
  }

  /**
   * Resolve the low-stock threshold for a product category from saved settings.
   */
  static async getThresholdForCategory(category: string | null | undefined): Promise<number> {
    const config = await this.getLowStockThresholds();
    return resolveLowStockThreshold(category, config);
  }

  /**
   * Persist per-category low-stock thresholds and immediately reconcile every
   * tracked product's threshold, stock status, and active stock alerts.
   */
  static async saveLowStockThresholds(
    input: Partial<LowStockThresholdConfig>,
  ): Promise<{ config: LowStockThresholdConfig; updatedProducts: number }> {
    const config = sanitizeLowStockThresholds(input);
    await setConfig(LOW_STOCK_THRESHOLDS_KEY, JSON.stringify(config), { encrypt: false });

    const [products, inventories] = await Promise.all([
      prisma.product.findMany({ select: { id: true, category: true } }),
      prisma.productInventory.findMany({
        select: { id: true, productId: true, lowStockThreshold: true },
      }),
    ]);

    const categoryByProductId = new Map(products.map((product) => [product.id, product.category]));
    let updatedProducts = 0;

    for (const inventory of inventories) {
      const category = categoryByProductId.get(inventory.productId);
      const nextThreshold = resolveLowStockThreshold(category, config);
      if (inventory.lowStockThreshold !== nextThreshold) {
        await prisma.productInventory.update({
          where: { id: inventory.id },
          data: { lowStockThreshold: nextThreshold },
        });
        updatedProducts++;
      }
      await this.updateStockStatus(inventory.productId);
    }

    return { config, updatedProducts };
  }

  /**
   * Re-sync a single product's threshold when its category changes.
   */
  static async syncProductCategoryThreshold(productId: string, category: string): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({
      where: { productId },
      select: { id: true, lowStockThreshold: true },
    });
    if (!inventory) return;
    const nextThreshold = await this.getThresholdForCategory(category);
    if (inventory.lowStockThreshold !== nextThreshold) {
      await prisma.productInventory.update({
        where: { id: inventory.id },
        data: { lowStockThreshold: nextThreshold },
      });
    }
    await this.updateStockStatus(productId);
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
    lowStockThresholds: LowStockThresholdConfig;
  }> {
    const [
      inventories,
      alerts,
      recentMovements,
      lowStockThresholds,
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
      }),
      this.getLowStockThresholds(),
    ]);

    const products = await getAllProducts();
    const inventoryMap = new Map(inventories.map((inv) => [inv.productId, inv]));

    let totalValue = 0;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach((product) => {
      const inv = inventoryMap.get(product.id);
      if (inv) {
        totalValue += inv.currentStock * product.price;
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
      } else if (product.availability === 'sold') {
        outOfStock++;
      } else {
        inStock++;
        totalValue += product.price;
      }
    });

    return {
      totalProducts: products.length,
      inStock,
      lowStock,
      outOfStock,
      totalValue,
      activeAlerts: alerts,
      recentMovements,
      lowStockThresholds,
    };
  }
}