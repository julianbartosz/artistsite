import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { DashboardData } from './types'
import { formatNumber } from './format'

interface Props {
  events: DashboardData['topEvents']
}

export function TopEvents({ events }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Events</CardTitle>
        <CardDescription>Most frequent user interactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.slice(0, 8).map((event, index) => (
            <div key={event.name} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                  {index + 1}
                </div>
                <span className="font-medium">{event.name.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <span className="text-gray-600">{formatNumber(event.count)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
