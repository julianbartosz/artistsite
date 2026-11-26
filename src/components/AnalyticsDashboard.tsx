'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Mail, Smartphone, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ChannelRange = '7d' | '30d' | '90d' | '1y'

interface ChannelPerformanceData {
  totalRevenue: number
  totalCost: number
  roi: number
  campaignPerformance?: {
    email?: { sent: number; opened: number; clicked: number; converted: number }
    social?: { posts: number; engagement: number; reach: number; clicks: number }
    ads?: { impressions: number; clicks: number; conversions: number; roas: number }
  }
  topPerformingChannels?: Array<{
    channel: string
    revenue: number
    cost: number
    roi: number
    conversions: number
  }>
}

interface DashboardData {
  overview: {
    totalEvents: number
    totalCustomers: number
    recentEvents: number
    totalRevenue?: number
    paidOrders?: number
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
  commission_waitlist: 'Commission waitlist',
  shop_page_view: 'Shop view',
}

function formatEventLabel(eventName: string): string {
  if (EVENT_LABELS[eventName]) return EVENT_LABELS[eventName]
  if (eventName.startsWith('market:')) {
    const slug = eventName.slice('market:'.length).trim()
    if (!slug) return 'Market visitor'
    const readable = slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
    return `Market: ${readable}`
  }
  const spaced = eventName.replace(/_/g, ' ').trim()
  if (!spaced) return 'Event'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

function safeFinite(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const analyticsFetcher = async (url: string): Promise<DashboardData> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch analytics data')
  }
  return response.json()
}

const channelFetcher = async ([, dateRange]: [string, ChannelRange]): Promise<ChannelPerformanceData> => {
  const response = await fetch('/api/marketing/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRange,
      channels: ['email', 'social', 'ads'],
      campaigns: [],
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to fetch channel performance')
  }
  return response.json()
}

export default function AnalyticsDashboard({
  onSelectTab,
}: {
  onSelectTab?: (tab: string) => void
} = {}) {
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [channelRange, setChannelRange] = useState<ChannelRange>('30d')
  const {
    data,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<DashboardData>('/api/analytics/dashboard', analyticsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    refreshInterval: 5 * 60 * 1000,
  })
  const {
    data: channelData,
    mutate: mutateChannelData,
  } = useSWR<ChannelPerformanceData>(
    ['analytics-channels', channelRange],
    channelFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
    },
  )

  const loading = isLoading || isValidating
  const error = clearError || (swrError instanceof Error ? swrError.message : null)
  const lastRefresh = data?.realTimeMetrics?.lastUpdated ? new Date(data.realTimeMetrics.lastUpdated) : null

  const fetchDashboardData = async () => {
    setClearError(null)
    await Promise.all([mutate(), mutateChannelData()])
  }

  const handleClearData = async () => {
    try {
      setClearing(true)
      setClearError(null)
      const response = await fetch('/api/analytics/dashboard', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to clear analytics data')
      }
      setConfirmClear(false)
      await mutate()
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Failed to clear analytics data')
    } finally {
      setClearing(false)
    }
  }

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
  const maxFunnelStep = Math.max(views, cartAdds, checkouts, purchases, 1)

  const funnelSteps = [
    { name: 'Product Views', count: views, width: views > 0 ? Math.max(4, Math.round((views / maxFunnelStep) * 100)) : 0, rate: views > 0 ? '100%' : null },
    { name: 'Add to Cart', count: cartAdds, width: cartAdds > 0 ? Math.max(4, Math.round((cartAdds / maxFunnelStep) * 100)) : 0, rate: views > 0 ? `${Math.min(100, (cartAdds / views) * 100).toFixed(1)}%` : null },
    { name: 'Begin Checkout', count: checkouts, width: checkouts > 0 ? Math.max(4, Math.round((checkouts / maxFunnelStep) * 100)) : 0, rate: views > 0 ? `${Math.min(100, (checkouts / views) * 100).toFixed(1)}%` : null },
    { name: 'Paid Purchases', count: purchases, width: purchases > 0 ? Math.max(4, Math.round((purchases / maxFunnelStep) * 100)) : 0, rate: views > 0 ? `${Math.min(100, (purchases / views) * 100).toFixed(1)}%` : null },
  ]

  const totalEvents = safeFinite(data.overview?.totalEvents)
  const totalRevenue = safeFinite(data.overview?.totalRevenue)
  const paidOrders = safeFinite(data.overview?.paidOrders)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Storefront activity, funnel, and collector lifetime value. Your own admin visits and Studio previews are excluded.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-start sm:items-end gap-1.5">
          <button
            type="button"
            onClick={() => void fetchDashboardData()}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
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
            <CardTitle className="text-sm font-medium text-gray-600">Paid Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {formatNumber(paidOrders)} paid {paidOrders === 1 ? 'order' : 'orders'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Collectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overview?.totalCustomers)}</div>
            <p className="text-xs text-gray-500 mt-1">Buyers &amp; profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.overview?.averageLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Spend per buyer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Median LTV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltvAnalysis?.medianLTV)}</div>
            <p className="text-xs text-gray-500 mt-1">Typical buyer spend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeFinite(data.overview?.conversionRate).toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">{views > 0 ? 'View to purchase' : 'Cart to purchase'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Visitor Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalEvents)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {formatNumber(data.overview?.recentEvents)} in last 24h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel & Top Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shop Conversion Funnel</CardTitle>
            <CardDescription>Collector journey from product view to paid order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelSteps.map((step) => (
                <div key={step.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{step.name}</span>
                    <span className="text-gray-600">
                      {formatNumber(step.count)}{step.rate ? ` (${step.rate})` : ''}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${step.width}%` }}
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

      {/* Channel & Campaign Performance */}
      {channelData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Channel Performance</CardTitle>
                  <CardDescription className="mt-1">
                    Attributed revenue and recorded spend ({channelData.totalCost > 0 ? `${formatCurrency(channelData.totalCost)} spend` : 'organic'})
                  </CardDescription>
                </div>
                <select
                  aria-label="Channel performance timeframe"
                  value={channelRange}
                  onChange={(event) => setChannelRange(event.target.value as ChannelRange)}
                  className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(channelData.topPerformingChannels ?? [])
                  .filter((channel) => channel && channel.channel)
                  .map((channel, index) => {
                    const hasRevenue = safeFinite(channel.revenue) > 0
                    const hasCost = safeFinite(channel.cost) > 0
                    const roiLabel = !hasRevenue && !hasCost
                      ? 'No activity'
                      : !hasCost && hasRevenue
                        ? 'Organic'
                        : Number.isFinite(channel.roi)
                          ? `${channel.roi.toFixed(1)}x ROI`
                          : 'No activity'
                    return (
                      <div key={channel.channel} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              !hasRevenue
                                ? 'bg-gray-300'
                                : index === 0
                                  ? 'bg-emerald-500'
                                  : index === 1
                                    ? 'bg-blue-500'
                                    : index === 2
                                      ? 'bg-amber-500'
                                      : 'bg-gray-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="font-medium capitalize text-gray-900">{channel.channel}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(channel.revenue)}</div>
                          <div className="text-xs text-gray-500">{roiLabel}</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Activity</CardTitle>
              <CardDescription>Recent newsletters, social posts, and ad spend logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                    <Mail className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    Email newsletters
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatNumber(channelData.campaignPerformance?.email?.sent)} sent
                    </div>
                    {onSelectTab ? (
                      <button
                        type="button"
                        onClick={() => onSelectTab('newsletter')}
                        className="text-xs text-gray-500 underline hover:text-gray-900"
                      >
                        Open Newsletter
                      </button>
                    ) : (
                      <Link href="/admin?tab=newsletter" className="text-xs text-gray-500 underline hover:text-gray-900">
                        Open Newsletter
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                    <Smartphone className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    Social posts
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatNumber(channelData.campaignPerformance?.social?.posts)} posts
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatNumber(channelData.campaignPerformance?.social?.reach)} reach
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                    <Target className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    Ad spend log
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatNumber(channelData.campaignPerformance?.ads?.conversions)} conversions
                    </div>
                    <div className="text-xs text-gray-500">
                      {safeFinite(channelData.campaignPerformance?.ads?.roas).toFixed(1)}x recorded ROAS ·{' '}
                      {onSelectTab ? (
                        <button
                          type="button"
                          onClick={() => onSelectTab('marketing')}
                          className="underline hover:text-gray-900"
                        >
                          Manage
                        </button>
                      ) : (
                        <Link href="/admin?tab=marketing" className="underline hover:text-gray-900">
                          Manage
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {totalEvents > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-gray-600">
            Need a fresh baseline after testing? Resetting clears visitor events only. Orders and customers stay intact.
          </span>
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Reset visitor events
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-red-800">Reset all recorded events?</span>
              <button
                type="button"
                onClick={() => void handleClearData()}
                disabled={clearing}
                className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                disabled={clearing}
                className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}