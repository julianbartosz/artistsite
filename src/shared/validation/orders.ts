import { z } from 'zod'

export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  phone: z.string().optional(),
})

export const CheckoutItemSchema = z.object({
  product: z.object({
    id: z.string(),
    title: z.string(),
    medium: z.string().optional(),
    dimensions: z.string().optional(),
    images: z
      .object({
        thumbnail: z.string().url().optional(),
      })
      .partial()
      .optional(),
    category: z.string().optional(),
    price: z.number().nonnegative(),
  }),
  quantity: z.number().int().positive(),
})

export const CustomerInfoSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export const CreateCheckoutSessionRequestSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1),
  customerInfo: CustomerInfoSchema,
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
})

export const CreateOrderRequestSchema = z.object({
  customerEmail: z.string().email(),
  customerId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        selectedVariant: z.any().optional(),
        customizations: z.any().array().optional(),
      })
    )
    .min(1),
  shippingAddress: ShippingAddressSchema,
  billingAddress: ShippingAddressSchema.optional(),
  shippingMethod: z.string().optional(),
  specialInstructions: z.string().optional(),
  giftMessage: z.string().optional(),
})

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.coerce.date().optional(),
  message: z.string().optional(),
  details: z.string().optional(),
})

export const SessionIdSchema = z.object({ session_id: z.string().min(1) })

// New: query schemas for orders endpoints
export const GetOrdersQuerySchema = z
  .object({
    customerEmail: z.string().email().optional(),
    customerId: z.string().optional(),
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  })
  .refine((v) => Boolean(v.customerEmail || v.customerId), {
    message: 'customerEmail or customerId is required',
    path: ['customerEmail'],
  })

export const OrderIdParamSchema = z.object({ id: z.string().min(1) })

export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>
