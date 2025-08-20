import 'server-only'
import { prisma } from '@/lib/db'
import { getAllProducts } from '@domain/shop'
import type {
  InventoryStatus,
  StockAlert,
  StockMovement,
  StockMovementData,
  StockStatus,
  StockAlertType,
  AlertSeverity
} from '@domain/shop'

export class InventoryService {
  /** Initialize inventory tracking for a product */
  static async initializeInventory(
    productId: string,
    initialStock: number = 0,
    lowStockThreshold: number = 5,
    allowBackorders: boolean = false
  ): Promise<void> {
    await prisma.productInventory.create({
      data: {
        productId,
        currentStock: initialStock,
        availableStock: initialStock,
        lowStockThreshold,
        allowBackorders,
        stockStatus: this.calculateStockStatus(initialStock, lowStockThreshold),
        isTrackingEnabled: true
      }
    })
    if (initialStock > 0) {
      await this.recordStockMovement({
        productId,
        type: 'restock',
        quantity: initialStock,
        reason: 'Initial inventory setup'
      })
    }
  }

  /** Get inventory status for a product */
  static async getInventoryStatus(productId: string): Promise<InventoryStatus | null> {
    const inventory = await prisma.productInventory.findUnique({
      where: { productId }
    })
    if (!inventory) return null
    return {
      productId: inventory.productId,
      currentStock: inventory.currentStock,
      availableStock: inventory.availableStock,
      reservedStock: inventory.reservedStock,
      stockStatus: inventory.stockStatus as StockStatus,
      lowStockThreshold: inventory.lowStockThreshold,
      allowBackorders: inventory.allowBackorders
    }
  }

  /** Get inventory status for multiple products */
  static async getBulkInventoryStatus(productIds: string[]): Promise<Map<string, InventoryStatus>> {
    const inventories = await prisma.productInventory.findMany({
      where: { productId: { in: productIds } }
    })
    const statusMap = new Map<string, InventoryStatus>()
    inventories.forEach(inventory => {
      statusMap.set(inventory.productId, {
        productId: inventory.productId,
        currentStock: inventory.currentStock,
        availableStock: inventory.availableStock,
        reservedStock: inventory.reservedStock,
        stockStatus: inventory.stockStatus as StockStatus,
        lowStockThreshold: inventory.lowStockThreshold,
        allowBackorders: inventory.allowBackorders
      })
    })
    return statusMap
  }

  /** Check if product is available for purchase */
  static async isProductAvailable(productId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.getInventoryStatus(productId)
    if (!inventory) return false
    if (inventory.stockStatus === 'discontinued') return false
    if (inventory.allowBackorders) return true
    return inventory.availableStock >= quantity
  }

  /** Reserve stock for checkout process */
  static async reserveStock(
    productId: string,
    quantity: number,
    expirationMinutes: number = 15,
    options: { orderId?: string; cartSessionId?: string; userId?: string } = {}
  ): Promise<string | null> {
    const inventory = await prisma.productInventory.findUnique({ where: { productId } })
    if (!inventory) return null
    if (!inventory.allowBackorders && inventory.availableStock < quantity) {
      return null
    }
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes)
    const reservation = await prisma.stockReservation.create({
      data: {
        productId,
        inventoryId: inventory.id,
        quantity,
        expiresAt,
        orderId: options.orderId,
        cartSessionId: options.cartSessionId,
        userId: options.userId
      }
    })
    await prisma.productInventory.update({
      where: { id: inventory.id },
      data: {
        reservedStock: { increment: quantity },
        availableStock: { decrement: quantity }
      }
    })
    await this.updateStockStatus(productId)
    return reservation.id
  }

  /** Release stock reservation */
  static async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { inventory: true }
    })
    if (!reservation || reservation.status !== 'active') return
    await prisma.stockReservation.update({ where: { id: reservationId }, data: { status: 'cancelled' } })
    await prisma.productInventory.update({
      where: { id: reservation.inventoryId },
      data: {
        reservedStock: { decrement: reservation.quantity },
        availableStock: { increment: reservation.quantity }
      }
    })
    await this.updateStockStatus(reservation.productId)
  }

  /** Fulfill stock reservation (convert to sale) */
  static async fulfillReservation(reservationId: string, orderId?: string): Promise<void> {
    const reservation = await prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { inventory: true }
    })
    if (!reservation || reservation.status !== 'active') return
    await prisma.stockReservation.update({
      where: { id: reservationId },
      data: {
        status: 'fulfilled',
        fulfilledAt: new Date(),
        orderId: orderId || reservation.orderId
      }
    })
    await this.recordStockMovement({
      productId: reservation.productId,
      type: 'sale',
      quantity: -reservation.quantity,
      orderId: orderId || reservation.orderId || undefined,
      reason: 'Order fulfillment'
    })
    await prisma.productInventory.update({
      where: { id: reservation.inventoryId },
      data: {
        currentStock: { decrement: reservation.quantity },
        reservedStock: { decrement: reservation.quantity },
        lastSold: new Date()
      }
    })
    await this.updateStockStatus(reservation.productId)
  }

  /** Record stock movement */
  static async recordStockMovement(data: StockMovementData): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({ where: { productId: data.productId } })
    if (!inventory) {
      throw new Error(`Inventory not found for product ${data.productId}`)
    }
    const previousStock = inventory.currentStock
    const newStock = previousStock + data.quantity
    await prisma.stockMovement.create({
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
        supplier: data.supplier
      }
    })
    const updateData: Partial<{ currentStock: number; availableStock: number; lastRestocked?: Date }> = {
      currentStock: newStock,
      availableStock: Math.max(0, newStock - inventory.reservedStock)
    }
    if (data.type === 'restock') {
      updateData.lastRestocked = new Date()
    }
    await prisma.productInventory.update({ where: { id: inventory.id }, data: updateData })
    await this.updateStockStatus(data.productId)
  }

  /** Update stock status based on current levels */
  static async updateStockStatus(productId: string): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({ where: { productId } })
    if (!inventory) return
    const newStatus = this.calculateStockStatus(inventory.availableStock, inventory.lowStockThreshold)
    if (newStatus !== inventory.stockStatus) {
      await prisma.productInventory.update({ where: { id: inventory.id }, data: { stockStatus: newStatus } })
      await this.checkAndCreateAlerts(productId, inventory.availableStock, newStatus)
    }
  }

  /** Calculate stock status based on available stock and threshold */
  private static calculateStockStatus(availableStock: number, lowStockThreshold: number): StockStatus {
    if (availableStock === 0) return 'out_of_stock'
    if (availableStock <= lowStockThreshold) return 'low_stock'
    return 'in_stock'
  }

  /** Check and create stock alerts */
  private static async checkAndCreateAlerts(
    productId: string,
    currentStock: number,
    stockStatus: StockStatus
  ): Promise<void> {
    const inventory = await prisma.productInventory.findUnique({ where: { productId } })
    if (!inventory) return
    const existingAlert = await prisma.stockAlert.findFirst({
      where: { productId, type: stockStatus === 'out_of_stock' ? 'out_of_stock' : 'low_stock', isActive: true }
    })
    if (existingAlert) return

    let alertType: StockAlertType
    let severity: AlertSeverity
    let message: string

    if (stockStatus === 'out_of_stock') {
      alertType = 'out_of_stock'
      severity = 'critical'
      message = `Product is out of stock`
    } else if (stockStatus === 'low_stock') {
      alertType = 'low_stock'
      severity = 'medium'
      message = `Product stock is low (${currentStock} remaining)`
    } else {
      return
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
    })
  }

  /** Get active stock alerts */
  static async getActiveAlerts(severityFilter?: AlertSeverity): Promise<StockAlert[]> {
    const where: { isActive: boolean; severity?: AlertSeverity } = { isActive: true }
    if (severityFilter) where.severity = severityFilter
    const alerts = await prisma.stockAlert.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }]
    })
    return alerts.map(alert => ({
      id: alert.id,
      productId: alert.productId,
      type: alert.type as StockAlertType,
      severity: alert.severity as AlertSeverity,
      message: alert.message,
      currentStock: alert.currentStock,
      thresholdValue: alert.thresholdValue || undefined,
      isActive: alert.isActive,
      createdAt: alert.createdAt
    }))
  }

  /** Acknowledge stock alert */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await prisma.stockAlert.update({
      where: { id: alertId },
      data: { isAcknowledged: true, acknowledgedBy: userId, acknowledgedAt: new Date() }
    })
  }

  /** Resolve stock alert */
  static async resolveAlert(alertId: string): Promise<void> {
    await prisma.stockAlert.update({ where: { id: alertId }, data: { isActive: false, resolvedAt: new Date() } })
  }

  /** Get stock movement history */
  static async getStockHistory(productId: string, limit: number = 50): Promise<StockMovement[]> {
    const rows = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    return rows.map(row => ({
      id: row.id,
      productId: row.productId,
      inventoryId: row.inventoryId,
      type: row.type as StockMovement['type'],
      quantity: row.quantity,
      previousStock: row.previousStock,
      newStock: row.newStock,
      orderId: row.orderId || undefined,
      userId: row.userId || undefined,
      reason: row.reason || undefined,
      notes: row.notes || undefined,
      cost: row.cost || undefined,
      supplier: row.supplier || undefined,
      createdAt: row.createdAt
    }))
  }

  /** Clean up expired reservations */
  static async cleanupExpiredReservations(): Promise<number> {
    const expiredReservations = await prisma.stockReservation.findMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
      include: { inventory: true }
    })
    let cleanedCount = 0
    for (const reservation of expiredReservations) {
      await prisma.stockReservation.update({ where: { id: reservation.id }, data: { status: 'expired' } })
      await prisma.productInventory.update({
        where: { id: reservation.inventoryId },
        data: { reservedStock: { decrement: reservation.quantity }, availableStock: { increment: reservation.quantity } }
      })
      await this.updateStockStatus(reservation.productId)
      cleanedCount++
    }
    return cleanedCount
  }

  /** Bulk update inventory levels (for admin use) */
  static async bulkUpdateInventory(
    updates: Array<{ productId: string; currentStock: number; lowStockThreshold?: number; allowBackorders?: boolean }>,
    userId: string
  ): Promise<void> {
    for (const update of updates) {
      const inventory = await prisma.productInventory.findUnique({ where: { productId: update.productId } })
      if (!inventory) {
        await this.initializeInventory(update.productId, update.currentStock, update.lowStockThreshold, update.allowBackorders)
        continue
      }
      const stockDifference = update.currentStock - inventory.currentStock
      if (stockDifference !== 0) {
        await this.recordStockMovement({
          productId: update.productId,
          type: 'adjustment',
          quantity: stockDifference,
          userId,
          reason: 'Bulk inventory update'
        })
      }
      const updateData: Partial<{ lowStockThreshold: number; allowBackorders: boolean }> = {}
      if (update.lowStockThreshold !== undefined) updateData.lowStockThreshold = update.lowStockThreshold
      if (update.allowBackorders !== undefined) updateData.allowBackorders = update.allowBackorders
      if (Object.keys(updateData).length > 0) {
        await prisma.productInventory.update({ where: { productId: update.productId }, data: updateData })
      }
    }
  }

  /** Get inventory dashboard data */
  static async getDashboardData(): Promise<{
    totalProducts: number
    inStock: number
    lowStock: number
    outOfStock: number
    totalValue: number
    activeAlerts: number
    recentMovements: StockMovement[]
  }> {
    const [inventories, alerts, recentMovements] = await Promise.all([
      prisma.productInventory.findMany(),
      prisma.stockAlert.count({ where: { isActive: true } }),
      prisma.stockMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { inventory: { select: { productId: true } } } })
    ])
    const products = getAllProducts()
    const productMap = new Map(products.map(p => [p.id, p]))
    let totalValue = 0
    let inStock = 0
    let lowStock = 0
    let outOfStock = 0
    inventories.forEach(inv => {
      const product = productMap.get(inv.productId)
      if (product) totalValue += inv.currentStock * product.price
      switch (inv.stockStatus) {
        case 'in_stock':
          inStock++
          break
        case 'low_stock':
          lowStock++
          break
        case 'out_of_stock':
          outOfStock++
          break
      }
    })
    const mappedRecentMovements: StockMovement[] = recentMovements.map(row => ({
      id: row.id,
      productId: row.productId,
      inventoryId: row.inventoryId,
      type: row.type as StockMovement['type'],
      quantity: row.quantity,
      previousStock: row.previousStock,
      newStock: row.newStock,
      orderId: row.orderId || undefined,
      userId: row.userId || undefined,
      reason: row.reason || undefined,
      notes: row.notes || undefined,
      cost: row.cost || undefined,
      supplier: row.supplier || undefined,
      createdAt: row.createdAt
    }))
    return {
      totalProducts: inventories.length,
      inStock,
      lowStock,
      outOfStock,
      totalValue,
      activeAlerts: alerts,
      recentMovements: mappedRecentMovements
    }
  }
}

export type { InventoryStatus, StockAlert, StockMovementData }