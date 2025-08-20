import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { PerformanceMetrics } from './types'

interface Props {
  data: PerformanceMetrics | null
}

export function PerformanceMetricsCard({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data ? (
          <>
            <div className="flex justify-between">
              <span>Average Response Time:</span>
              <span className="font-semibold">{data.averageResponseTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span>P95 Response Time:</span>
              <span className="font-semibold">{data.p95ResponseTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Requests/Second:</span>
              <span className="font-semibold">{data.requestsPerSecond}</span>
            </div>
            <div className="flex justify-between">
              <span>Memory Usage:</span>
              <span className="font-semibold">{data.memoryUsage}MB</span>
            </div>
            <div className="flex justify-between">
              <span>CPU Usage:</span>
              <span className="font-semibold">{data.cpuUsage}%</span>
            </div>
          </>
        ) : (
          <p>No performance data available</p>
        )}
      </CardContent>
    </Card>
  )
}
