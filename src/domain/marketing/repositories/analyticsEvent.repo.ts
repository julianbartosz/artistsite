// filepath: src/domain/marketing/repositories/analyticsEvent.repo.ts
import { prisma } from '@/lib/db'

export class AnalyticsEventRepository {
  async create(eventName: string, params?: { userId?: string | null; properties?: Record<string, unknown> }): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        userId: params?.userId ?? undefined,
        properties: params?.properties ? JSON.stringify(params.properties) : '{}',
        timestamp: new Date(),
      },
    })
  }
  async findManyByEventAndPropsContains(
    eventNames: string[] | string,
    contains: string
  ) {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames]
    return prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: names },
        properties: { contains },
      },
    })
  }
}