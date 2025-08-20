import { describe, it, expect } from '@jest/globals'
import {
  GetOrdersQuerySchema,
  UpdateOrderStatusSchema,
  CreateCheckoutSessionRequestSchema,
} from './orders'

describe('Orders DTO Schemas', () => {
  it('GetOrdersQuerySchema requires customerEmail or customerId', () => {
    const result = GetOrdersQuerySchema.safeParse({})
    expect(result.success).toBe(false)
  })
  it('GetOrdersQuerySchema accepts customerEmail', () => {
    const result = GetOrdersQuerySchema.safeParse({ customerEmail: 'test@example.com' })
    expect(result.success).toBe(true)
  })
  it('GetOrdersQuerySchema accepts customerId', () => {
    const result = GetOrdersQuerySchema.safeParse({ customerId: 'user_123' })
    expect(result.success).toBe(true)
  })
  it('UpdateOrderStatusSchema accepts valid status and optional fields', () => {
    const result = UpdateOrderStatusSchema.safeParse({
      status: 'shipped',
      trackingNumber: 'TRACK123',
      estimatedDelivery: new Date(),
    })
    expect(result.success).toBe(true)
  })
  it('UpdateOrderStatusSchema rejects invalid status', () => {
    const result = UpdateOrderStatusSchema.safeParse({ status: 'foo' })
    expect(result.success).toBe(false)
  })
  it('CreateCheckoutSessionRequestSchema validates minimal payload', () => {
    const result = CreateCheckoutSessionRequestSchema.safeParse({
      items: [
        {
          product: { id: 'p1', title: 'Art Piece', price: 100 },
          quantity: 1,
        },
      ],
      customerInfo: { email: 'buyer@example.com' },
      subtotal: 100,
      shipping: 10,
      tax: 8,
      total: 118,
    })
    expect(result.success).toBe(true)
  })
})
