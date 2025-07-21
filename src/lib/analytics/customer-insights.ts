import { prisma } from '@/lib/db'
import { CustomerProfile } from '@/lib/db'

export interface CustomerSegment {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
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

export class CustomerInsights {
  /**
   * Get all customer segments with analytics
   */
  static async getCustomerSegments(): Promise<CustomerSegment[]> {
    const profiles = await prisma.customerProfile.findMany({
      select: {
        segments: true,
        lifetimeValue: true,
        engagementScore: true,
        behaviorScore: true,
      },
    })

    // Predefined segments
    const segmentDefinitions = {
      high_value_customer: {
        name: 'High Value Customers',
        description: 'Customers with lifetime value > $500',
        criteria: { lifetimeValue: { min: 500 } },
      },
      active_shopper: {
        name: 'Active Shoppers',
        description: 'Users who frequently add items to cart',
        criteria: { segments: ['active_shopper'] },
      },
      art_enthusiast: {
        name: 'Art Enthusiasts',
        description: 'Users who regularly view portfolio and artwork',
        criteria: { segments: ['art_enthusiast'] },
      },
      newsletter_subscriber: {
        name: 'Newsletter Subscribers',
        description: 'Users subscribed to newsletter',
        criteria: { segments: ['newsletter_subscriber'] },
      },
      potential_client: {
        name: 'Potential Clients',
        description: 'Users who have shown interest in commissions',
        criteria: { segments: ['potential_client'] },
      },
      cart_abandoner: {
        name: 'Cart Abandoners',
        description: 'Users who add to cart but don\'t complete purchase',
        criteria: { segments: ['cart_abandoner'] },
      },
    }

    const segments: CustomerSegment[] = []

    for (const [id, definition] of Object.entries(segmentDefinitions)) {
      const matchingProfiles = profiles.filter(profile => 
        this.profileMatchesCriteria(profile, definition.criteria)
      )

      const avgLTV = matchingProfiles.length > 0
        ? matchingProfiles.reduce((sum, p) => sum + p.lifetimeValue, 0) / matchingProfiles.length
        : 0

      const avgEngagement = matchingProfiles.length > 0
        ? matchingProfiles.reduce((sum, p) => sum + p.engagementScore, 0) / matchingProfiles.length
        : 0

      segments.push({
        id,
        name: definition.name,
        description: definition.description,
        criteria: definition.criteria,
        userCount: matchingProfiles.length,
        averageLifetimeValue: avgLTV,
        engagementScore: avgEngagement,
      })
    }

    return segments
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
      ...profile,
      segments: JSON.parse(profile.segments),
      preferences: JSON.parse(profile.preferences),
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

        const activeInPeriod = await prisma.analyticsEvent.count({
          where: {
            userId: { in: cohortProfiles.map(p => p.id) },
            timestamp: {
              gte: periodStart,
              lt: periodEnd,
            },
          },
          distinct: ['userId'],
        })

        periods.push({
          period: `Month ${month}`,
          activeUsers: activeInPeriod,
          retentionRate: (activeInPeriod / cohort.cohortSize) * 100,
        })
      }

      cohort.periods = periods
    }

    return Object.values(cohorts)
  }

  /**
   * Calculate lifetime value analysis
   */
  static async calculateLifetimeValue(): Promise<LTVAnalysis> {
    const profiles = await prisma.customerProfile.findMany({
      select: {
        lifetimeValue: true,
        segments: true,
        createdAt: true,
      },
    })

    const ltvValues = profiles.map(p => p.lifetimeValue).sort((a, b) => a - b)
    const averageLTV = ltvValues.reduce((sum, val) => sum + val, 0) / ltvValues.length
    const medianLTV = ltvValues[Math.floor(ltvValues.length / 2)]

    // LTV by segment
    const ltvBySegment: Record<string, number> = {}
    const segmentGroups: Record<string, number[]> = {}

    profiles.forEach(profile => {
      const segments = JSON.parse(profile.segments)
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

    const averageEngagement = profiles.reduce((sum, p) => sum + p.engagementScore, 0) / profiles.length

    // Engagement by segment
    const engagementBySegment: Record<string, number> = {}
    const segmentGroups: Record<string, number[]> = {}

    profiles.forEach(profile => {
      const segments = JSON.parse(profile.segments)
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
}