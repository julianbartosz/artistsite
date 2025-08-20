import { prisma } from '@/lib/db'

// Basic repository abstraction for Customer Insights related data access
export class InsightsRepository {
  async getDistinctSegmentsByEmail(): Promise<string[]> {
    const profiles = await prisma.customerProfile.findMany({
      select: { segments: true, email: true },
      distinct: ['email'],
    })
    const all = new Set<string>()
    profiles.forEach(p => {
      const segments = typeof p.segments === 'string' ? JSON.parse(p.segments) : (p.segments || [])
      segments.forEach((s: string) => all.add(s))
    })
    return Array.from(all)
  }

  async getProfilesBySegment(segmentId: string, limit = 100) {
    const segmentWhere: Record<string, unknown> = {
      high_value_customer: { lifetimeValue: { gte: 500 } },
      active_shopper: { segments: { contains: 'active_shopper' } },
      art_enthusiast: { segments: { contains: 'art_enthusiast' } },
      newsletter_subscriber: { segments: { contains: 'newsletter_subscriber' } },
      potential_client: { segments: { contains: 'potential_client' } },
      cart_abandoner: { segments: { contains: 'cart_abandoner' } },
    }
    const where = (segmentWhere as any)[segmentId] || {}
    return prisma.customerProfile.findMany({
      where,
      take: limit,
      orderBy: { lifetimeValue: 'desc' },
    })
  }

  async getProfilesWithFirstEvent() {
    return prisma.customerProfile.findMany({
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
          take: 1,
        },
      },
    })
  }

  async getEventsForUsersInPeriod(userIds: string[], start: Date, end: Date) {
    if (!userIds.length) return []
    return prisma.analyticsEvent.findMany({
      where: { userId: { in: userIds }, timestamp: { gte: start, lt: end } },
      select: { userId: true },
    })
  }

  async getProfilesForLTV() {
    return prisma.customerProfile.findMany({
      select: { lifetimeValue: true, segments: true, createdAt: true },
    })
  }

  async getProfilesForEngagement() {
    return prisma.customerProfile.findMany({ select: { engagementScore: true, segments: true } })
  }

  async getRecentEvents(days = 30) {
    return prisma.analyticsEvent.findMany({
      select: { eventName: true, timestamp: true },
      where: { timestamp: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
    })
  }

  async findProfileById(userId: string) {
    return prisma.customerProfile.findUnique({
      where: { id: userId },
      include: { events: { orderBy: { timestamp: 'desc' }, take: 50 } },
    })
  }

  async updateProfileSegments(userId: string, segments: string[]) {
    await prisma.customerProfile.update({ where: { id: userId }, data: { segments: JSON.stringify(segments) } })
  }

  async ensureProfile(userId: string) {
    let profile = await prisma.customerProfile.findUnique({ where: { id: userId } })
    if (!profile) {
      profile = await prisma.customerProfile.create({
        data: {
          id: userId,
          segments: JSON.stringify([]),
          behaviorScore: 0,
          preferences: JSON.stringify({}),
          lifetimeValue: 0,
          engagementScore: 0,
          lastActivity: new Date(),
        },
      })
    }
    return profile
  }

  async countPurchasesForUser(userId: string) {
    return prisma.analyticsEvent.count({ where: { userId, eventName: 'purchase' } })
  }
}