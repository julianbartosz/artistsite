import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import { formatCurrency, formatNumber } from './format'
import type { DashboardData } from './types'

interface Props {
  overview: DashboardData['overview']
  medianLTV: DashboardData['ltvAnalysis']['medianLTV']
}

export function OverviewMetrics({ overview, medianLTV }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(overview.totalEvents)}</div>
          <p className="text-xs text-gray-500 mt-1">{overview.recentEvents} in last 24h</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(overview.totalCustomers)}</div>
          <p className="text-xs text-gray-500 mt-1">Total profiles</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.conversionRate.toFixed(1)}%</div>
          <p className="text-xs text-gray-500 mt-1">View to purchase</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Avg Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(overview.averageEngagement)}</div>
          <p className="text-xs text-gray-500 mt-1">Engagement score</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Average LTV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.averageLTV)}</div>
          <p className="text-xs text-gray-500 mt-1">Customer lifetime value</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Median LTV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(medianLTV)}</div>
          <p className="text-xs text-gray-500 mt-1">Median value</p>
        </CardContent>
      </Card>
    </div>
  )
}
