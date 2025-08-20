export type TabKey = 'overview' | 'campaigns' | 'automation' | 'analytics'

export interface MarketingOverview {
  totalRevenue: number
  totalCost: number
  roi: number
  activeCustomers: number
  campaignPerformance: {
    email: { sent: number; opened: number; clicked: number; converted: number }
    social: { posts: number; engagement: number; reach: number; clicks: number }
    ads: { impressions: number; clicks: number; conversions: number; roas: number }
  }
  topPerformingChannels: Array<{
    channel: string
    revenue: number
    cost: number
    roi: number
    conversions: number
  }>
}

export interface DashboardFilters {
  dateRange: '7d' | '30d' | '90d' | '1y'
  channels: string[]
  campaigns: string[]
}
