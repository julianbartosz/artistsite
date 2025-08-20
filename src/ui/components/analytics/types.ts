export interface DashboardData {
  overview: {
    totalEvents: number
    totalCustomers: number
    recentEvents: number
    conversionRate: number
    averageEngagement: number
    averageLTV: number
  }
  topEvents: { name: string; count: number }[]
  segments: Array<{
    id: string
    name: string
    userCount: number
    averageLifetimeValue: number
    engagementScore: number
  }>
  conversionData: {
    overallConversionRate: number
    cartConversionRate: number
    checkoutConversionRate: number
    funnelSteps: {
      views: number
      cartAdds: number
      checkouts: number
      purchases: number
    }
  }
  realTimeMetrics: {
    activeUsers: number
    recentEvents: number
    recentPurchases: number
    lastUpdated: string
  }
  ltvAnalysis: {
    averageLTV: number
    medianLTV: number
    ltvBySegment: Record<string, number>
  }
  engagementTrends: {
    averageEngagement: number
    engagementBySegment: Record<string, number>
    topEngagementActivities: Array<{
      activity: string
      averageScore: number
      frequency: number
    }>
  }
}
