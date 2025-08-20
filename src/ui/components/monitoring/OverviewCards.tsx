import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import { Badge } from '@ui/components/ui/badge'
import type { PerformanceMetrics, SecurityStatus, SystemHealth } from './types'
import { getHealthBadgeColor } from './status'

interface Props {
  performanceData: PerformanceMetrics | null
  securityStatus: SecurityStatus | null
  systemHealth: SystemHealth | null
}

export function OverviewCards({ performanceData, securityStatus, systemHealth }: Props) {
  const overallHealth: 'healthy' | 'warning' | 'error' | null = systemHealth
    ? (Object.values(systemHealth).includes('error')
        ? 'error'
        : Object.values(systemHealth).includes('warning')
        ? 'warning'
        : 'healthy')
    : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {overallHealth ? (
              <Badge className={getHealthBadgeColor(overallHealth)}>
                {overallHealth === 'error' ? 'Critical' : overallHealth === 'warning' ? 'Warning' : 'Healthy'}
              </Badge>
            ) : (
              'Loading...'
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performanceData ? `${performanceData.averageResponseTime}ms` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">Average response time</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Security Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {securityStatus ? `${securityStatus.overallScore}%` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            {securityStatus?.criticalIssues || 0} critical issues
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performanceData ? `${performanceData.errorRate.toFixed(2)}%` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">Last 24 hours</p>
        </CardContent>
      </Card>
    </div>
  )
}
