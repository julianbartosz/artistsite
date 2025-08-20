import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { DashboardData } from './types'

interface Props {
  metrics: DashboardData['realTimeMetrics']
}

export function RealTimeMetrics({ metrics }: Props) {
  return (
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
            <div className="text-2xl font-bold text-green-800">{metrics.activeUsers}</div>
            <div className="text-sm text-green-600">Active Users (1h)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-800">{metrics.recentEvents}</div>
            <div className="text-sm text-green-600">Events (5m)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-800">{metrics.recentPurchases}</div>
            <div className="text-sm text-green-600">Purchases (1h)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
