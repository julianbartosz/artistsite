import { prisma } from '@/lib/db'

// Data mappers
function parseEvent(e: any) {
  return {
    id: e.id,
    eventName: e.eventName,
    userId: e.userId ?? undefined,
    sessionId: e.sessionId ?? undefined,
    properties: JSON.parse(e.properties || '{}'),
    timestamp: e.timestamp,
    pageUrl: e.pageUrl ?? undefined,
  }
}

export const AnalyticsRepository = {
  async createEvent(data: {
    eventName: string
    userId?: string
    sessionId?: string
    properties: Record<string, unknown>
    pageUrl?: string
  }) {
    const event = await prisma.analyticsEvent.create({
      data: {
        eventName: data.eventName,
        userId: data.userId,
        sessionId: data.sessionId,
        properties: JSON.stringify(data.properties || {}),
        pageUrl: data.pageUrl,
        timestamp: new Date(),
      },
    })
    return parseEvent(event)
  },
  async listEvents(filters: { eventName?: string; userId?: string; sessionId?: string; limit: number; offset: number }) {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        ...(filters.eventName ? { eventName: filters.eventName } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(filters.limit, 1000),
      skip: filters.offset,
    })
    return events.map(parseEvent)
  },
  async getCustomerProfile(id: string) {
    return prisma.customerProfile.findUnique({ where: { id } })
  },
  async createCustomerProfile(id: string) {
    return prisma.customerProfile.create({
      data: {
        id,
        segments: JSON.stringify([]),
        behaviorScore: 0,
        preferences: JSON.stringify({}),
        lifetimeValue: 0,
        engagementScore: 0,
        lastActivity: new Date(),
      },
    })
  },
  async updateCustomerProfile(id: string, data: Partial<{ engagementScore: number; lifetimeValue: number; segments: string[] }>) {
    return prisma.customerProfile.update({
      where: { id },
      data: {
        ...(data.engagementScore !== undefined ? { engagementScore: data.engagementScore } : {}),
        ...(data.lifetimeValue !== undefined ? { lifetimeValue: data.lifetimeValue } : {}),
        ...(data.segments ? { segments: JSON.stringify(data.segments) } : {}),
        lastActivity: new Date(),
      },
    })
  },
}
