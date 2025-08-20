import type { CustomerProfile } from '@shared/types'
import { InsightsRepository } from '../repositories/insights.repo'

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

const repo = new InsightsRepository()

export class CustomerInsights {
  static async getCustomerSegments(): Promise<string[]> {
    return repo.getDistinctSegmentsByEmail()
  }

  static async getSegmentCustomers(segmentId: string, limit = 100): Promise<CustomerProfile[]> {
    const profiles = await repo.getProfilesBySegment(segmentId, limit)
    return profiles.map((profile: any) => ({
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

  static async generateRetentionCohorts(): Promise<CohortData[]> {
    const profiles = await repo.getProfilesWithFirstEvent()
    const cohorts: Record<string, CohortData> = {}
    profiles.forEach((profile: any) => {
      if (profile.events.length === 0) return
      const firstActivity = profile.events[0].timestamp
      const cohortKey = `${firstActivity.getFullYear()}-${String(firstActivity.getMonth() + 1).padStart(2, '0')}`
      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = { cohortName: cohortKey, cohortSize: 0, periods: [] }
      }
      cohorts[cohortKey].cohortSize++
    })
    for (const cohort of Object.values(cohorts)) {
      const cohortProfiles = profiles.filter((profile: any) => {
        if (profile.events.length === 0) return false
        const firstActivity = profile.events[0].timestamp
        const key = `${firstActivity.getFullYear()}-${String(firstActivity.getMonth() + 1).padStart(2, '0')}`
        return key === cohort.cohortName
      })
      const periods = [] as CohortData['periods']
      const now = new Date()
      const cohortStart = new Date(cohort.cohortName + '-01')
      for (let month = 0; month < 12 && cohortStart.getTime() + month * 30 * 24 * 60 * 60 * 1000 < now.getTime(); month++) {
        const periodStart = new Date(cohortStart.getTime() + month * 30 * 24 * 60 * 60 * 1000)
        const periodEnd = new Date(cohortStart.getTime() + (month + 1) * 30 * 24 * 60 * 60 * 1000)
        const events = await repo.getEventsForUsersInPeriod(cohortProfiles.map((p: any) => p.id), periodStart, periodEnd)
        const activeInPeriod = new Set(events.map(e => e.userId)).size
        periods.push({ period: `Month ${month}`, activeUsers: activeInPeriod, retentionRate: (activeInPeriod / cohort.cohortSize) * 100 })
      }
      cohort.periods = periods
    }
    return Object.values(cohorts)
  }

  static async calculateLifetimeValue(): Promise<LTVAnalysis> {
    const profiles = await repo.getProfilesForLTV()
    const values = profiles.map((p: any) => p.lifetimeValue).sort((a: number, b: number) => a - b)
    const averageLTV = values.length ? values.reduce((s: number, v: number) => s + v, 0) / values.length : 0
    const medianLTV = values.length ? values[Math.floor(values.length / 2)] : 0
    const segmentGroups: Record<string, number[]> = {}
    profiles.forEach((profile: any) => {
      const segments = typeof profile.segments === 'string' ? JSON.parse(profile.segments) : profile.segments || []
      segments.forEach((segment: string) => {
        if (!segmentGroups[segment]) segmentGroups[segment] = []
        segmentGroups[segment].push(profile.lifetimeValue)
      })
    })
    const ltvBySegment: Record<string, number> = {}
    Object.entries(segmentGroups).forEach(([segment, vals]) => {
      ltvBySegment[segment] = vals.reduce((s, v) => s + v, 0) / vals.length
    })
    const monthlyGroups: Record<string, { sum: number; count: number }> = {}
    profiles.forEach((profile: any) => {
      const month = `${profile.createdAt.getFullYear()}-${String(profile.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyGroups[month]) monthlyGroups[month] = { sum: 0, count: 0 }
      monthlyGroups[month].sum += profile.lifetimeValue
      monthlyGroups[month].count += 1
    })
    const ltvTrends = Object.entries(monthlyGroups).map(([month, data]) => ({
      month,
      averageLTV: data.sum / data.count,
      customerCount: data.count,
    }))
    return { averageLTV, medianLTV, ltvBySegment, ltvTrends }
  }

  static async analyzeEngagementTrends(): Promise<EngagementTrends> {
    const profiles = await repo.getProfilesForEngagement()
    const events = await repo.getRecentEvents(30)
    const averageEngagement = profiles.length ? profiles.reduce((sum: number, p: any) => sum + p.engagementScore, 0) / profiles.length : 0
    const segmentGroups: Record<string, number[]> = {}
    profiles.forEach((profile: any) => {
      const segments = typeof profile.segments === 'string' ? JSON.parse(profile.segments) : profile.segments || []
      segments.forEach((segment: string) => {
        if (!segmentGroups[segment]) segmentGroups[segment] = []
        segmentGroups[segment].push(profile.engagementScore)
      })
    })
    const engagementBySegment: Record<string, number> = {}
    Object.entries(segmentGroups).forEach(([segment, scores]) => {
      engagementBySegment[segment] = scores.reduce((sum, s) => sum + s, 0) / scores.length
    })
    const eventCounts: Record<string, number> = {}
    events.forEach((event: any) => {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1
    })
    const topEngagementActivities = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([activity, frequency]) => ({ activity, averageScore: this.getEngagementScoreForEvent(activity), frequency }))
    const overallTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    return { overallTrend, averageEngagement, engagementBySegment, topEngagementActivities }
  }

  static async updateCustomerSegmentation(userId: string): Promise<void> {
    const profile = await repo.findProfileById(userId)
    if (!profile) return
    const recentEvents = profile.events
    const eventCounts: Record<string, number> = {}
    recentEvents.forEach((event: any) => {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1
    })
    const newSegments: string[] = []
    if ((eventCounts['add_to_cart'] || 0) >= 3) newSegments.push('active_shopper')
    const artViews = (eventCounts['portfolio_view'] || 0) + (eventCounts['artwork_view'] || 0)
    if (artViews >= 5) newSegments.push('art_enthusiast')
    if ((profile as any).engagementScore > 500) newSegments.push('highly_engaged')
    if (eventCounts['add_to_cart'] && !eventCounts['purchase']) newSegments.push('cart_abandoner')
    await repo.updateProfileSegments(userId, newSegments)
  }

  static async getUserInsights(userId: string): Promise<any> {
    const profile = await repo.ensureProfile(userId)
    if (!profile) {
      return { lifetime_value: 0, engagement_score: 0, purchase_frequency: 0, last_purchase_date: null, segment: 'new_user', acquisition_source: 'direct', favorite_categories: [], art_preferences: [] }
    }
    const purchaseEvents = await repo.countPurchasesForUser(userId)
    return {
      lifetime_value: (profile as any).lifetimeValue,
      engagement_score: (profile as any).engagementScore,
      purchase_frequency: purchaseEvents,
      last_purchase_date: (profile as any).lastActivity,
      segment: typeof (profile as any).segments === 'string' ? JSON.parse((profile as any).segments)[0] : (profile as any).segments?.[0] || 'new_user',
      acquisition_source: 'website',
      favorite_categories: [],
      art_preferences: [],
    }
  }

  static async getSegmentUsers(segment: string): Promise<any[]> {
    const profiles = await repo.getProfilesBySegment(segment, 100)
    return profiles.map((profile: any) => ({ id: profile.id, email: profile.email, segment }))
  }

  private static getEngagementScoreForEvent(eventName: string): number {
    const scores: Record<string, number> = {
      page_view: 1,
      view_item: 2,
      add_to_cart: 5,
      purchase: 15,
      newsletter_signup: 10,
      portfolio_view: 3,
      artwork_view: 4,
    }
    return scores[eventName] || 1
  }
}
