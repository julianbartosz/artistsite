'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { debug } from '@/lib/debug'
import type { DashboardFilters, MarketingOverview, TabKey } from './types'
import { HeaderFilters } from './HeaderFilters'
import { TabNav } from './TabNav'
import { OverviewTab } from './OverviewTab'
import { CampaignsTab } from './CampaignsTab'
import { AutomationTab } from './AutomationTab'
import { AnalyticsTab } from './AnalyticsTab'

export default function UnifiedMarketingDashboard() {
  const [overview, setOverview] = useState<MarketingOverview | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30d',
    channels: ['email', 'social', 'ads', 'crm'],
    campaigns: []
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      })
      const data = (await res.json()) as MarketingOverview
      setOverview(data)
    } catch (error) {
      debug.error('Error loading dashboard data', error as Error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <HeaderFilters
        filters={filters}
        onDateRangeChange={(range) => setFilters({ ...filters, dateRange: range })}
        onChannelsChange={(channels) => setFilters({ ...filters, channels })}
      />

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && <OverviewTab overview={overview} />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'automation' && <AutomationTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </div>
  )
}
