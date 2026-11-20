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

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page view',
  portfolio_view: 'Portfolio view',
  artwork_view: 'Artwork view',
  view_item: 'Product view',
  add_to_cart: 'Added to cart',
  begin_checkout: 'Started checkout',
  purchase: 'Purchase',
  newsletter_form_view: 'Newsletter form view',
  newsletter_signup: 'Newsletter signup',
  contact_form_view: 'Contact form view',
  commission_inquiry: 'Commission inquiry',
  shop_page_view: 'Shop view',
}

function formatEventLabel(eventName: string): string {
  if (EVENT_LABELS[eventName]) return EVENT_LABELS[eventName]
  const spaced = eventName.replace(/_/g, ' ').trim()
  if (!spaced) return 'Event'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

function safeFinite(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
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

  const handleClearData = async () => {
    try {
      setClearing(true)
      const response = await fetch('/api/analytics/dashboard', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to clear analytics data')
      }
      setConfirmClear(false)
      await fetchDashboardData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear analytics data')
    } finally {
      setClearing(false)
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
      <div className="p-6">
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
      <div className="p-6">
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

  const formatNumber = (value: unknown) => {
    const num = safeFinite(value)
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return Math.round(num).toLocaleString('en-US')
  }

  const formatCurrency = (value: unknown) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(safeFinite(value))
  }

  const views = safeFinite(data.conversionData?.funnelSteps?.views)
  const cartAdds = safeFinite(data.conversionData?.funnelSteps?.cartAdds)
  const checkouts = safeFinite(data.conversionData?.funnelSteps?.checkouts)
  const purchases = safeFinite(data.conversionData?.funnelSteps?.purchases)

  const funnelSteps = [
    { name: 'Product Views', count: views, rate: views > 0 ? 100 : 0 },
    { name: 'Add to Cart', count: cartAdds, rate: views > 0 ? Math.min(100, (cartAdds / views) * 100) : 0 },
    { name: 'Begin Checkout', count: checkouts, rate: views > 0 ? Math.min(100, (checkouts / views) * 100) : 0 },
    { name: 'Purchase', count: purchases, rate: views > 0 ? Math.min(100, (purchases / views) * 100) : 0 },
  ]

  const totalEvents = safeFinite(data.overview?.totalEvents)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-600">
            Visitor activity and conversion insights. Your own admin visits and Studio previews are excluded.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-start sm:items-end gap-1.5">
          <div className="flex items-center gap-2 whitespace-nowrap">
            {totalEvents > 0 && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 bg-white rounded hover:bg-gray-50"
              >
                Clear data
              </button>
            )}
            {confirmClear && (
              <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
                <span className="text-red-800">Reset all recorded events?</span>
                <button
                  type="button"
                  onClick={handleClearData}
                  disabled={clearing}
                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {clearing ? 'Clearing...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={clearing}
                  className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-red-100"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {lastRefresh && (
            <p className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Real-time Metrics */}
      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-emerald-900 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" aria-hidden="true"></span>
            Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-900">
                {formatNumber(data.realTimeMetrics?.activeUsers)}
              </div>
              <div className="text-sm text-emerald-700">Active visitors (1h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-900">
                {formatNumber(data.realTimeMetrics?.recentEvents)}
              </div>
              <div className="text-sm text-emerald-700">Events (5m)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-900">
                {formatNumber(data.realTimeMetrics?.recentPurchases)}
              </div>
              <div className="text-sm text-emerald-700">Purchases (1h)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalEvents)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {formatNumber(data.overview?.recentEvents)} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overview?.totalCustomers)}</div>
            <p className="text-xs text-gray-500 mt-1">Total profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeFinite(data.overview?.conversionRate).toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">View to purchase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(safeFinite(data.overview?.averageEngagement))}</div>
            <p className="text-xs text-gray-500 mt-1">Engagement score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.overview?.averageLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Customer lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Median LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltvAnalysis?.medianLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Median value</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel & Top Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shop Conversion Funnel</CardTitle>
            <CardDescription>Collector journey from product view to purchase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelSteps.map((step) => (
                <div key={step.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{step.name}</span>
                    <span className="text-gray-600">
                      {formatNumber(step.count)} ({step.rate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${step.rate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Activity</CardTitle>
            <CardDescription>Most frequent visitor interactions</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topEvents.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No visitor events recorded yet. Activity appears here automatically as visitors browse your portfolio, shop, and newsletter.
              </p>
            ) : (
              <div className="space-y-3">
                {data.topEvents.slice(0, 8).map((event, index) => (
                  <div key={event.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{formatEventLabel(event.name)}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{formatNumber(event.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
          <CardDescription>Collector groups based on browsing and purchase behavior</CardDescription>
        </CardHeader>
        <CardContent>
          {data.segments.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              No collector segments yet. Segments populate as collectors create accounts, subscribe, or place orders.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.segments.map((segment) => (
                <div key={segment.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-base text-gray-900">{formatEventLabel(segment.name)}</h3>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Collectors:</span>
                      <span className="font-medium">{formatNumber(segment.userCount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg LTV:</span>
                      <span className="font-medium">{formatCurrency(segment.averageLifetimeValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Engagement:</span>
                      <span className="font-medium">{Math.round(safeFinite(segment.engagementScore))}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}