'use client'
import { useEffect, useState } from 'react'
import { HeaderControls } from './HeaderControls'
import { RealTimeMetrics } from './RealTimeMetrics'
import { OverviewMetrics } from './OverviewMetrics'
import { ConversionFunnel } from './ConversionFunnel'
import { SegmentsGrid } from './SegmentsGrid'
import { TopEvents } from './TopEvents'
import { TopEngagementActivities } from './TopEngagementActivities'
import type { DashboardData } from './types'

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/dashboard')
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      const dashboardData = (await response.json()) as DashboardData
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
        <div className="border border-red-200 bg-red-50 rounded p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-red-800 text-xl font-semibold">Error Loading Analytics</h2>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-8 space-y-8">
      <HeaderControls loading={loading} lastRefresh={lastRefresh} onRefresh={fetchDashboardData} />

      <RealTimeMetrics metrics={data.realTimeMetrics} />

      <OverviewMetrics overview={data.overview} medianLTV={data.ltvAnalysis.medianLTV} />

      <ConversionFunnel funnel={data.conversionData.funnelSteps} />

      <SegmentsGrid segments={data.segments} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopEvents events={data.topEvents} />
        <TopEngagementActivities activities={data.engagementTrends.topEngagementActivities} />
      </div>
    </div>
  )
}
