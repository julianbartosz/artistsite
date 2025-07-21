'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardData {
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

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/dashboard')
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      
      const dashboardData = await response.json()
      setData(dashboardData)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Analytics</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Real-time insights and customer analytics
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {lastRefresh && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Real-time Metrics */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Real-time Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-800">
                {data.realTimeMetrics.activeUsers}
              </div>
              <div className="text-sm text-green-600">Active Users (1h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-800">
                {data.realTimeMetrics.recentEvents}
              </div>
              <div className="text-sm text-green-600">Events (5m)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-800">
                {data.realTimeMetrics.recentPurchases}
              </div>
              <div className="text-sm text-green-600">Purchases (1h)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overview.totalEvents)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {data.overview.recentEvents} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overview.totalCustomers)}</div>
            <p className="text-xs text-gray-500 mt-1">Total profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">View to purchase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.overview.averageEngagement)}</div>
            <p className="text-xs text-gray-500 mt-1">Engagement score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.overview.averageLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Customer lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Median LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltvAnalysis.medianLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Median value</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>E-commerce Conversion Funnel</CardTitle>
          <CardDescription>Customer journey from view to purchase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: 'Product Views', count: data.conversionData.funnelSteps.views, rate: 100 },
              { 
                name: 'Add to Cart', 
                count: data.conversionData.funnelSteps.cartAdds,
                rate: data.conversionData.funnelSteps.views > 0 
                  ? (data.conversionData.funnelSteps.cartAdds / data.conversionData.funnelSteps.views) * 100 
                  : 0
              },
              { 
                name: 'Begin Checkout', 
                count: data.conversionData.funnelSteps.checkouts,
                rate: data.conversionData.funnelSteps.views > 0 
                  ? (data.conversionData.funnelSteps.checkouts / data.conversionData.funnelSteps.views) * 100 
                  : 0
              },
              { 
                name: 'Purchase', 
                count: data.conversionData.funnelSteps.purchases,
                rate: data.conversionData.funnelSteps.views > 0 
                  ? (data.conversionData.funnelSteps.purchases / data.conversionData.funnelSteps.views) * 100 
                  : 0
              },
            ].map((step, index) => (
              <div key={step.name} className="flex items-center space-x-4">
                <div className="w-32 text-sm font-medium">{step.name}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                  <div 
                    className="bg-blue-600 h-6 rounded-full transition-all duration-300"
                    style={{ width: `${step.rate}%` }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {formatNumber(step.count)} ({step.rate.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
          <CardDescription>User groups based on behavior and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.segments.map((segment) => (
              <div key={segment.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg">{segment.name}</h3>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Users:</span>
                    <span className="font-medium">{formatNumber(segment.userCount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg LTV:</span>
                    <span className="font-medium">{formatCurrency(segment.averageLifetimeValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Engagement:</span>
                    <span className="font-medium">{Math.round(segment.engagementScore)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Events</CardTitle>
            <CardDescription>Most frequent user interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topEvents.slice(0, 8).map((event, index) => (
                <div key={event.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <span className="font-medium">{event.name.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <span className="text-gray-600">{formatNumber(event.count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Engagement Activities</CardTitle>
            <CardDescription>Activities driving highest engagement scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.engagementTrends.topEngagementActivities.slice(0, 8).map((activity, index) => (
                <div key={activity.activity} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-600">
                      {index + 1}
                    </div>
                    <span className="font-medium">{activity.activity.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{activity.averageScore}</div>
                    <div className="text-xs text-gray-500">{formatNumber(activity.frequency)} times</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}