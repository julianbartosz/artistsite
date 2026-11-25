import { prisma } from '@/lib/db'
import { CustomerProfile } from '@/lib/db'
import { shouldIgnoreAnalyticsPageUrl } from '@/lib/analytics/funnels'

export { shouldIgnoreAnalyticsPageUrl }

export interface CustomerSegment {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
  userCount: number
  averageLifetimeValue: number
  engagementScore: number
}

export interface CustomerSegmentSummary {
  id: string
  name: string
  userCount: number
  averageLifetimeValue: number
  engagementScore: number
}

export interface SegmentCriteria {
  behaviorScore?: { min?: number; max?: number }
  lifetimeValue?: { min?: number; max?: number }
  engagementScore?: { min?: number; max?: number }
  segments?: string[]
  lastActivity?: { days: number; operator: 'within' | 'after' }
  eventHistory?: { eventName: string; count: number; operator: 'min' | 'max' | 'exact' }[]
}

export interface CohortData {
  cohortName: string
  cohortSize: number
  periods: Array<{
    period: string
    activeUsers: number
    retentionRate: number
  }>
}

export interface LTVAnalysis {
  averageLTV: number
  medianLTV: number
  ltvBySegment: Record<string, number>
  ltvTrends: Array<{
    month: string
    averageLTV: number
    customerCount: number
  }>
}

export interface EngagementTrends {
  overallTrend: 'increasing' | 'decreasing' | 'stable'
  averageEngagement: number
  engagementBySegment: Record<string, number>
  topEngagementActivities: Array<{
    activity: string
    averageScore: number
    frequency: number
  }>
}

export interface TrackableAnalyticsEvent {
  eventName: string
  userId?: string
  email?: string
  sessionId?: string
  properties: Record<string, unknown>
  pageUrl?: string
}

export interface AnalyticsEventRecordResult {
  stored: boolean
  eventId?: string
  ignored?: boolean
}

function isForeignKeyConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'P2003'
  )
}

async function createAnalyticsEvent(input: TrackableAnalyticsEvent, userId?: string) {
  return prisma.analyticsEvent.create({
    data: {
      eventName: input.eventName,
      userId,
      sessionId: input.sessionId,
      properties: JSON.stringify(input.properties),
      pageUrl: input.pageUrl,
      timestamp: new Date(),
    },
  })
}

async function resolveOrCreateCustomerProfile(
  userId?: string,
  email?: string,
): Promise<string | undefined> {
  const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined
  const normalizedId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined

  if (normalizedEmail) {
    const byEmail = await prisma.customerProfile.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }).catch(() => null)
    if (byEmail?.id) return byEmail.id
  }

  if (normalizedId) {
    const byId = await prisma.customerProfile.findUnique({
      where: { id: normalizedId },
      select: { id: true, email: true },
    }).catch(() => null)
    if (byId?.id) {
      if (normalizedEmail && !byId.email) {
        await prisma.customerProfile.update({
          where: { id: byId.id },
          data: { email: normalizedEmail },
        }).catch(() => undefined)
      }
      return byId.id
    }
  }

  if (!normalizedId && !normalizedEmail) return undefined

  try {
    const created = await prisma.customerProfile.create({
      data: {
        ...(normalizedId ? { id: normalizedId } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        segments: JSON.stringify([]),
        behaviorScore: 0,
        preferences: JSON.stringify({}),
        lifetimeValue: 0,
        engagementScore: 0,
        lastActivity: new Date(),
      },
      select: { id: true },
    })
    return created.id
  } catch {
    if (normalizedEmail) {
      const existing = await prisma.customerProfile.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }).catch(() => null)
      if (existing?.id) return existing.id
    }
    if (normalizedId) {
      const existing = await prisma.customerProfile.findUnique({
        where: { id: normalizedId },
        select: { id: true },
      }).catch(() => null)
      if (existing?.id) return existing.id
    }
    return undefined
  }
}

export async function linkSessionEventsToProfile(sessionId: string, profileId: string): Promise<number> {
  const cleanSession = sessionId.trim()
  const cleanProfile = profileId.trim()
  if (!cleanSession || !cleanProfile) return 0

  try {
    const unlinked = await prisma.analyticsEvent.findMany({
      where: { sessionId: cleanSession, userId: null },
      select: { id: true, eventName: true, properties: true },
      take: 200,
    })
    if (unlinked.length === 0) return 0

    await prisma.analyticsEvent.updateMany({
      where: { id: { in: unlinked.map((entry) => entry.id) }, userId: null },
      data: { userId: cleanProfile },
    })

    const profile = await prisma.customerProfile.findUnique({ where: { id: cleanProfile } })
    if (profile) {
      let engagementScore = profile.engagementScore
      let segments = parseJsonArray(profile.segments)
      for (const entry of unlinked) {
        engagementScore = Math.min(engagementScore + calculateEngagementBonus(entry.eventName), 1000)
        let parsedProps: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(entry.properties || '{}')
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedProps = parsed
        } catch {
          parsedProps = {}
        }
        segments = updateUserSegments(segments, entry.eventName, parsedProps)
      }
      await prisma.customerProfile.update({
        where: { id: cleanProfile },
        data: {
          engagementScore,
          segments: JSON.stringify(segments),
          lastActivity: new Date(),
        },
      })
    }

    return unlinked.length
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Session event backfill skipped:', error)
    }
    return 0
  }
}

export async function recordAnalyticsEvent(input: TrackableAnalyticsEvent): Promise<AnalyticsEventRecordResult> {
  if (shouldIgnoreAnalyticsPageUrl(input.pageUrl)) {
    return { stored: false, ignored: true }
  }

  try {
    const resolvedProfileId =
      input.userId || input.email
        ? await resolveOrCreateCustomerProfile(input.userId, input.email)
        : undefined
    const event = await createAnalyticsEvent(input, resolvedProfileId)

    if (resolvedProfileId) {
      try {
        await updateCustomerProfile(resolvedProfileId, input.eventName, input.properties)
      } catch (error) {
        if (!isForeignKeyConstraintError(error)) throw error
      }
    }

    return { stored: true, eventId: event.id }
  } catch (error) {
    if (input.userId && isForeignKeyConstraintError(error)) {
      const event = await createAnalyticsEvent(input)
      return { stored: true, eventId: event.id }
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics event persistence skipped:', error)
    }
    return { stored: false }
  }
}

async function updateCustomerProfile(userId: string, eventName: string, properties: Record<string, unknown>) {
  try {
    let profile = await prisma.customerProfile.findUnique({
      where: { id: userId },
    })

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

    const engagementBonus = calculateEngagementBonus(eventName)
    const newEngagementScore = Math.min(profile.engagementScore + engagementBonus, 1000)
    const purchaseValue = eventName === 'purchase' && properties.value ? Number(properties.value) : 0
    const newLifetimeValue = profile.lifetimeValue + (Number.isFinite(purchaseValue) ? purchaseValue : 0)
    const currentSegments = parseJsonArray(profile.segments)
    const newSegments = updateUserSegments(currentSegments, eventName, properties)

    await prisma.customerProfile.update({
      where: { id: userId },
      data: {
        engagementScore: newEngagementScore,
        lifetimeValue: newLifetimeValue,
        segments: JSON.stringify(newSegments),
        lastActivity: new Date(),
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Customer profile update skipped:', error)
    }
  }
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function calculateEngagementBonus(eventName: string): number {
  const engagementValues: Record<string, number> = {
    page_view: 1,
    view_item: 2,
    add_to_cart: 5,
    begin_checkout: 8,
    purchase: 15,
    newsletter_signup: 10,
    contact_form_submit: 12,
    portfolio_view: 3,
    artwork_view: 4,
    social_share: 6,
    blog_read: 3,
    search: 2,
    wishlist_add: 4,
  }

  return engagementValues[eventName] || 1
}

function updateUserSegments(currentSegments: string[], eventName: string, properties: Record<string, unknown>): string[] {
  const segments = new Set(currentSegments)

  if (eventName === 'purchase') {
    segments.add('customer')
    if (properties.value && Number(properties.value) > 500) {
      segments.add('high_value_customer')
    }
  }

  if (eventName === 'add_to_cart') segments.add('active_shopper')
  if (eventName === 'newsletter_signup') segments.add('newsletter_subscriber')
  if (eventName === 'portfolio_view' || eventName === 'artwork_view') segments.add('art_enthusiast')
  if (eventName === 'contact_form_submit' || eventName === 'commission_inquiry') segments.add('potential_client')
  if (eventName === 'purchase') segments.delete('cart_abandoner')

  return Array.from(segments)
}

export class CustomerInsights {
  private static parseSegments(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((segment): segment is string => typeof segment === 'string')
    if (typeof value !== 'string') return []

    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((segment): segment is string => typeof segment === 'string')
        : []
    } catch {
      return []
    }
  }

  /**
   * Get all customer segments with analytics
   */
  static async getCustomerSegments(): Promise<string[]> {
    try {
      const profiles = await prisma.customerProfile.findMany({
        select: {
          segments: true,
          email: true // Use email instead of userId since userId doesn't exist in schema
        },
        distinct: ['email'], // Use email for distinct since userId doesn't exist
      });

      const allSegments = new Set<string>();
      
      profiles.forEach(profile => {
        const segments = this.parseSegments(profile.segments);
        segments.forEach((segment: string) => allSegments.add(segment));
      });

      return Array.from(allSegments);
    } catch (error) {
      throw new Error(`Failed to get customer segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get segment summaries in the shape expected by analytics dashboards.
   */
  static async getCustomerSegmentsWithStats(): Promise<CustomerSegmentSummary[]> {
    try {
      const profiles = await prisma.customerProfile.findMany({
        select: {
          segments: true,
          lifetimeValue: true,
          engagementScore: true,
        },
      })

      const segmentStats = new Map<string, { count: number; lifetimeValue: number; engagementScore: number }>()

      profiles.forEach(profile => {
        this.parseSegments(profile.segments).forEach(segment => {
          const current = segmentStats.get(segment) || { count: 0, lifetimeValue: 0, engagementScore: 0 }
          current.count += 1
          current.lifetimeValue += profile.lifetimeValue
          current.engagementScore += profile.engagementScore
          segmentStats.set(segment, current)
        })
      })

      return Array.from(segmentStats.entries())
        .map(([segment, stats]) => ({
          id: segment,
          name: segment.replace(/_/g, ' '),
          userCount: stats.count,
          averageLifetimeValue: stats.count ? stats.lifetimeValue / stats.count : 0,
          engagementScore: stats.count ? stats.engagementScore / stats.count : 0,
        }))
        .sort((a, b) => b.userCount - a.userCount)
    } catch (error) {
      throw new Error(`Failed to get customer segment stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get customers in a specific segment
   */
  static async getSegmentCustomers(segmentId: string, limit = 100): Promise<CustomerProfile[]> {
    const segmentDefinitions = {
      high_value_customer: { lifetimeValue: { gte: 500 } },
      active_shopper: { segments: { contains: 'active_shopper' } },
      art_enthusiast: { segments: { contains: 'art_enthusiast' } },
      newsletter_subscriber: { segments: { contains: 'newsletter_subscriber' } },
      potential_client: { segments: { contains: 'potential_client' } },
      cart_abandoner: { segments: { contains: 'cart_abandoner' } },
    }

    const where = segmentDefinitions[segmentId as keyof typeof segmentDefinitions] || {}

    const profiles = await prisma.customerProfile.findMany({
      where,
      take: limit,
      orderBy: { lifetimeValue: 'desc' },
    })

    return profiles.map(profile => ({
      id: profile.id,
      email: profile.email || '',
      behavior_score: profile.behaviorScore,
      lifetime_value: profile.lifetimeValue,
      engagement_score: profile.engagementScore,
      last_activity: profile.lastActivity,
      segments: typeof profile.segments === 'string' ? JSON.parse(profile.segments) : [],
      preferences: typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : {},
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }))
  }

  /**
   * Generate retention cohorts
   */
  static async generateRetentionCohorts(): Promise<CohortData[]> {
    const profiles = await prisma.customerProfile.findMany({
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
          take: 1,
        },
      },
    })

    const cohorts: Record<string, CohortData> = {}

    // Group users by their first activity month
    profiles.forEach(profile => {
      if (profile.events.length === 0) return

      const firstActivity = profile.events[0].timestamp
      const cohortKey = `${firstActivity.getFullYear()}-${String(firstActivity.getMonth() + 1).padStart(2, '0')}`

      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = {
          cohortName: cohortKey,
          cohortSize: 0,
          periods: [],
        }
      }

      cohorts[cohortKey].cohortSize++
    })

    // Calculate retention for each cohort
    for (const cohort of Object.values(cohorts)) {
      const cohortProfiles = profiles.filter(profile => {
        if (profile.events.length === 0) return false
        const firstActivity = profile.events[0].timestamp
        const cohortKey = `${firstActivity.getFullYear()}-${String(firstActivity.getMonth() + 1).padStart(2, '0')}`
        return cohortKey === cohort.cohortName
      })

      // Calculate retention for each month after cohort start
      const periods = []
      const now = new Date()
      const cohortStart = new Date(cohort.cohortName + '-01')

      for (let month = 0; month < 12 && cohortStart.getTime() + (month * 30 * 24 * 60 * 60 * 1000) < now.getTime(); month++) {
        const periodStart = new Date(cohortStart.getTime() + (month * 30 * 24 * 60 * 60 * 1000))
        const periodEnd = new Date(cohortStart.getTime() + ((month + 1) * 30 * 24 * 60 * 60 * 1000))

        const uniqueUserIds = new Set<string>()
        const events = await prisma.analyticsEvent.findMany({
          where: {
            userId: { in: cohortProfiles.map(p => p.id) },
            timestamp: {
              gte: periodStart,
              lt: periodEnd,
            },
          },
          select: { userId: true }
        })

        events.forEach(event => {
          if (event.userId) {
            uniqueUserIds.add(event.userId)
          }
        })

        const activeInPeriod = uniqueUserIds.size

        periods.push({
          period: `Month ${month}`,
          activeUsers: activeInPeriod,
          retentionRate: cohort.cohortSize > 0 ? (activeInPeriod / cohort.cohortSize) * 100 : 0,
        })
      }

      cohort.periods = periods
    }

    return Object.values(cohorts)
  }

  /**
   * Authoritative commerce metrics derived directly from paid Order records.
   * Shared by Analytics and Marketing dashboards so revenue, buyers, and LTV never drift.
   */
  static async getOrderCommerceMetrics(startDate?: Date): Promise<{
    paidOrderCount: number
    totalRevenue: number
    uniqueCustomers: number
    averageLTV: number
    medianLTV: number
    repeatCustomers: number
  }> {
    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'paid',
        ...(startDate ? { createdAt: { gte: startDate } } : {}),
      },
      select: {
        userId: true,
        userEmail: true,
        total: true,
      },
    })

    const spendByCustomer = new Map<string, { total: number; orders: number }>()
    let totalRevenue = 0
    for (const order of paidOrders) {
      const amount = Number(order.total || 0)
      totalRevenue += amount
      const key = (order.userId || order.userEmail || 'guest').toLowerCase()
      const current = spendByCustomer.get(key) || { total: 0, orders: 0 }
      current.total += amount
      current.orders += 1
      spendByCustomer.set(key, current)
    }

    const totals = Array.from(spendByCustomer.values())
      .map((entry) => entry.total)
      .sort((a, b) => a - b)
    const uniqueCustomers = totals.length
    const averageLTV = uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0
    const mid = Math.floor(uniqueCustomers / 2)
    const medianLTV = uniqueCustomers === 0
      ? 0
      : uniqueCustomers % 2 === 1
        ? totals[mid]
        : (totals[mid - 1] + totals[mid]) / 2
    const repeatCustomers = Array.from(spendByCustomer.values()).filter((entry) => entry.orders > 1).length

    return {
      paidOrderCount: paidOrders.length,
      totalRevenue,
      uniqueCustomers,
      averageLTV,
      medianLTV,
      repeatCustomers,
    }
  }

  /**
   * Calculate lifetime value analysis (grounded in real paid orders when present)
   */
  static async calculateLifetimeValue(): Promise<LTVAnalysis> {
    const [profiles, orderMetrics] = await Promise.all([
      prisma.customerProfile.findMany({
        select: {
          lifetimeValue: true,
          segments: true,
          createdAt: true,
        },
      }),
      this.getOrderCommerceMetrics(),
    ])

    const profileLtvValues = profiles.map(p => p.lifetimeValue).filter((v) => v > 0).sort((a, b) => a - b)
    const count = profileLtvValues.length
    const profileAverageLTV = count > 0
      ? profileLtvValues.reduce((sum, val) => sum + val, 0) / count
      : 0
    const mid = Math.floor(count / 2)
    const profileMedianLTV = count === 0
      ? 0
      : count % 2 === 1
        ? profileLtvValues[mid]
        : (profileLtvValues[mid - 1] + profileLtvValues[mid]) / 2

    const averageLTV = orderMetrics.uniqueCustomers > 0 ? orderMetrics.averageLTV : profileAverageLTV
    const medianLTV = orderMetrics.uniqueCustomers > 0 ? orderMetrics.medianLTV : profileMedianLTV

    // LTV by segment
    const ltvBySegment: Record<string, number> = {}
    const segmentGroups: Record<string, number[]> = {}

    profiles.forEach(profile => {
      const segments = typeof profile.segments === 'string' ? JSON.parse(profile.segments) : profile.segments || [];
      segments.forEach((segment: string) => {
        if (!segmentGroups[segment]) {
          segmentGroups[segment] = []
        }
        segmentGroups[segment].push(profile.lifetimeValue)
      })
    })

    Object.entries(segmentGroups).forEach(([segment, values]) => {
      ltvBySegment[segment] = values.reduce((sum, val) => sum + val, 0) / values.length
    })

    // LTV trends by month
    const monthlyGroups: Record<string, { sum: number; count: number }> = {}
    profiles.forEach(profile => {
      const month = `${profile.createdAt.getFullYear()}-${String(profile.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = { sum: 0, count: 0 }
      }
      monthlyGroups[month].sum += profile.lifetimeValue
      monthlyGroups[month].count += 1
    })

    const ltvTrends = Object.entries(monthlyGroups).map(([month, data]) => ({
      month,
      averageLTV: data.sum / data.count,
      customerCount: data.count,
    }))

    return {
      averageLTV,
      medianLTV,
      ltvBySegment,
      ltvTrends,
    }
  }

  /**
   * Analyze engagement trends
   */
  static async analyzeEngagementTrends(): Promise<EngagementTrends> {
    const profiles = await prisma.customerProfile.findMany({
      select: {
        engagementScore: true,
        segments: true,
      },
    })

    const events = await prisma.analyticsEvent.findMany({
      select: {
        eventName: true,
        timestamp: true,
      },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    })

    const averageEngagement = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.engagementScore, 0) / profiles.length
      : 0

    // Engagement by segment
    const engagementBySegment: Record<string, number> = {}
    const segmentGroups: Record<string, number[]> = {}

    profiles.forEach(profile => {
      const segments = typeof profile.segments === 'string' ? JSON.parse(profile.segments) : profile.segments || [];
      segments.forEach((segment: string) => {
        if (!segmentGroups[segment]) {
          segmentGroups[segment] = []
        }
        segmentGroups[segment].push(profile.engagementScore)
      })
    })

    Object.entries(segmentGroups).forEach(([segment, scores]) => {
      engagementBySegment[segment] = scores.reduce((sum, score) => sum + score, 0) / scores.length
    })

    // Top engagement activities
    const eventCounts: Record<string, number> = {}
    events.forEach(event => {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1
    })

    const topEngagementActivities = Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([activity, frequency]) => ({
        activity,
        averageScore: this.getEngagementScoreForEvent(activity),
        frequency,
      }))

    // Determine trend (simplified)
    const overallTrend: 'increasing' | 'decreasing' | 'stable' = 'stable' // Would need historical data for real trend

    return {
      overallTrend,
      averageEngagement,
      engagementBySegment,
      topEngagementActivities,
    }
  }

  /**
   * Update customer segment based on recent behavior
   */
  static async updateCustomerSegmentation(userId: string): Promise<void> {
    const profile = await prisma.customerProfile.findUnique({
      where: { id: userId },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
          take: 50, // Last 50 events
        },
      },
    })

    if (!profile) return

    const recentEvents = profile.events
    const eventCounts: Record<string, number> = {}
    recentEvents.forEach(event => {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1
    })

    // Determine new segments based on recent behavior
    const newSegments: string[] = []

    // Shopping behavior
    if (eventCounts['add_to_cart'] >= 3) {
      newSegments.push('active_shopper')
    }

    // Art interest
    if ((eventCounts['portfolio_view'] || 0) + (eventCounts['artwork_view'] || 0) >= 5) {
      newSegments.push('art_enthusiast')
    }

    // Engagement level
    if (profile.engagementScore > 500) {
      newSegments.push('highly_engaged')
    }

    // Cart abandonment (added to cart but no recent purchase)
    if (eventCounts['add_to_cart'] && !eventCounts['purchase']) {
      newSegments.push('cart_abandoner')
    }

    // Update the profile
    await prisma.customerProfile.update({
      where: { id: userId },
      data: {
        segments: JSON.stringify(newSegments),
      },
    })
  }

  /**
   * Check if profile matches segment criteria
   */
  private static profileMatchesCriteria(profile: any, criteria: SegmentCriteria): boolean {
    const segments = JSON.parse(profile.segments)

    if (criteria.lifetimeValue) {
      if (criteria.lifetimeValue.min && profile.lifetimeValue < criteria.lifetimeValue.min) return false
      if (criteria.lifetimeValue.max && profile.lifetimeValue > criteria.lifetimeValue.max) return false
    }

    if (criteria.engagementScore) {
      if (criteria.engagementScore.min && profile.engagementScore < criteria.engagementScore.min) return false
      if (criteria.engagementScore.max && profile.engagementScore > criteria.engagementScore.max) return false
    }

    if (criteria.segments) {
      const hasRequiredSegments = criteria.segments.some(segment => segments.includes(segment))
      if (!hasRequiredSegments) return false
    }

    return true
  }

  /**
   * Get engagement score for event type
   */
  private static getEngagementScoreForEvent(eventName: string): number {
    const scores: Record<string, number> = {
      'page_view': 1,
      'view_item': 2,
      'add_to_cart': 5,
      'purchase': 15,
      'newsletter_signup': 10,
      'portfolio_view': 3,
      'artwork_view': 4,
    }
    return scores[eventName] || 1
  }

  /**
   * Add missing getUserInsights method
   */
  static async getUserInsights(userId: string): Promise<any> {
    const profile = await prisma.customerProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      return {
        lifetime_value: 0,
        engagement_score: 0,
        purchase_frequency: 0,
        last_purchase_date: null,
        segment: 'new_user',
        acquisition_source: 'direct',
        favorite_categories: [],
        art_preferences: [],
      }
    }

    // Calculate purchase frequency from analytics events
    const purchaseEvents = await prisma.analyticsEvent.count({
      where: {
        userId: userId,
        eventName: 'purchase'
      }
    });

    return {
      lifetime_value: profile.lifetimeValue,
      engagement_score: profile.engagementScore,
      purchase_frequency: purchaseEvents,
      last_purchase_date: profile.lastActivity,
      segment: typeof profile.segments === 'string' ? JSON.parse(profile.segments)[0] : profile.segments?.[0] || 'new_user',
      acquisition_source: 'website',
      favorite_categories: [],
      art_preferences: [],
    }
  }

  /**
   * Add missing getSegmentUsers method
   */
  static async getSegmentUsers(segment: string): Promise<any[]> {
    const profiles = await prisma.customerProfile.findMany({
      where: {
        segments: {
          contains: segment
        }
      },
      take: 100
    })

    return profiles.map(profile => ({
      id: profile.id,
      email: profile.email,
      segment: segment
    }))
  }
}