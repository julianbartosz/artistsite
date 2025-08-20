// Domain types for Shop Inventory
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'

export interface InventoryStatus {
  productId: string
  currentStock: number
  availableStock: number
  reservedStock: number
  stockStatus: StockStatus
  lowStockThreshold: number
  allowBackorders: boolean
}

export type StockMovementType = 'restock' | 'sale' | 'adjustment'

export interface StockMovement {
  id: string
  productId: string
  inventoryId: string
  type: StockMovementType
  quantity: number
  previousStock: number
  newStock: number
  orderId?: string
  userId?: string
  reason?: string
  notes?: string
  cost?: number
  supplier?: string
  createdAt: Date
}

export interface StockMovementData {
  productId: string
  type: StockMovementType
  quantity: number
  orderId?: string
  userId?: string
  reason?: string
  notes?: string
  cost?: number
  supplier?: string
}

export type StockAlertType = 'low_stock' | 'out_of_stock'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface StockAlert {
  id: string
  productId: string
  type: StockAlertType
  severity: AlertSeverity
  message: string
  currentStock: number
  thresholdValue?: number
  isActive: boolean
  createdAt: Date
}
