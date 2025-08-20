// Shim module: prefer importing from @domain/orders going forward.
export type {
  OrderStatus,
  OrderType,
  OrderItem,
  ShippingAddress,
  OrderTimeline,
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderEmailData,
  OrderStats,
} from '@domain/orders'
export { OrderService } from '@domain/orders'
import { OrderService as _OrderService } from '@domain/orders'

// Backward-compatible facade
export class OrderManager {
  static generateOrderNumber = _OrderService.generateOrderNumber
  static calculateOrderTotals = _OrderService.calculateOrderTotals
  static createTimelineEntry = _OrderService.createTimelineEntry
  static getStatusMessage = _OrderService.getStatusMessage
  static validateShippingAddress = _OrderService.validateShippingAddress
  static calculateShippingCost = _OrderService.calculateShippingCost
  static canCancelOrder = _OrderService.canCancelOrder
  static canRefundOrder = _OrderService.canRefundOrder
}