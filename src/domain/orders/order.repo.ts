import { prisma } from '@/lib/db'

export class OrderRepository {
  async findByIdWithUserAndItems(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, items: true },
    })
  }

  async findRecent(days = 30, take = 50) {
    return prisma.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
      include: { user: true, items: true },
      take,
    })
  }

  async findRecentByUserId(userId: string, days = 365, take = 5) {
    return prisma.order.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take,
    })
  }

  // New: detailed fetch including items, timeline, and addresses
  async findByIdDetailed(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        timeline: true,
        shippingAddress: true,
        user: true,
      },
    })
  }

  // New: update order status and append a timeline entry
  async updateStatus(orderId: string, input: { status: string; message: string; details?: string; trackingNumber?: string; estimatedDelivery?: Date }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          trackingNumber: input.trackingNumber,
          estimatedDelivery: input.estimatedDelivery,
        },
      })
      await tx.orderTimelineEntry.create({
        data: {
          orderId,
          status: input.status,
          message: input.message,
          details: input.details,
          trackingNumber: input.trackingNumber,
        },
      })
      return order
    })
  }
}
