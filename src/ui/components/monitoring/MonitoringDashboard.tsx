'use client'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@ui/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/ui/tabs'
import { HeaderActions } from './HeaderActions'
import { OverviewCards } from './OverviewCards'
import { PerformanceMetricsCard } from './PerformanceMetricsCard'
import { PerformanceTrendsCard } from './PerformanceTrendsCard'
import { SecurityStatusCard } from './SecurityStatusCard'
import { SystemComponentsCard } from './SystemComponentsCard'
import type { PerformanceMetrics, SecurityStatus, SystemHealth } from './types'

export default function MonitoringDashboard() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null)
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMonitoringData = async () => {
    try {
      const [perfResponse, secResponse, healthResponse] = await Promise.all([
        fetch('/api/monitoring/performance'),
        fetch('/api/monitoring/security'),
        fetch('/api/monitoring/health')
      ])

      if (perfResponse.ok) setPerformanceData(await perfResponse.json())
      if (secResponse.ok) setSecurityStatus(await secResponse.json())
      if (healthResponse.ok) setSystemHealth(await healthResponse.json())
      setError(null)
    } catch {
      setError('Failed to fetch monitoring data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonitoringData()
    const interval = setInterval(fetchMonitoringData, 30_000)
    return () => clearInterval(interval)
  }, [])

  const runSecurityAudit = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/security/audit', { method: 'POST' })
      if (response.ok) await fetchMonitoringData()
    } catch {
      setError('Failed to run security audit')
    } finally {
      setLoading(false)
    }
  }

  const runPerformanceTest = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/performance/test', { method: 'POST' })
      if (response.ok) await fetchMonitoringData()
    } catch {
      setError('Failed to run performance test')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <HeaderActions
        loading={loading}
        onSecurityAudit={runSecurityAudit}
        onPerformanceTest={runPerformanceTest}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewCards
            performanceData={performanceData}
            securityStatus={securityStatus}
            systemHealth={systemHealth}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PerformanceMetricsCard data={performanceData} />
            <PerformanceTrendsCard />
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityStatusCard securityStatus={securityStatus} />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SystemComponentsCard systemHealth={systemHealth} />
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Environment:</span>
                <span className="font-semibold">{process.env.NODE_ENV}</span>
              </div>
              <div className="flex justify-between">
                <span>Version:</span>
                <span className="font-semibold">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Last Deployment:</span>
                <span className="font-semibold">Today</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
