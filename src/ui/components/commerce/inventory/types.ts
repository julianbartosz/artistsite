import type { StockAlert } from '@/lib/inventory'

export interface DashboardData {
  totalProducts: number
  inStock: number
  lowStock: number
  outOfStock: number
  totalValue: number
  activeAlerts: number
  recentMovements: any[]
}

export interface ProductListItem {
  id: string
  title: string
  medium: string
  category: string
  price: number
  images: { thumbnail: string }
}

export type InventoryTab = 'overview' | 'alerts' | 'products'

export interface AlertsHandlers {
  onAcknowledge: (alertId: string) => void
  onResolve: (alertId: string) => void
}

export type { StockAlert }
