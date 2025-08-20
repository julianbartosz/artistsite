import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { DashboardData } from './types'
import { formatCurrency, formatNumber } from './format'

interface Props {
  segments: DashboardData['segments']
}

export function SegmentsGrid({ segments }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Segments</CardTitle>
        <CardDescription>User groups based on behavior and engagement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((segment) => (
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
  )
}
