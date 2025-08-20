import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { DashboardData } from './types'
import { formatNumber } from './format'

interface Props {
  activities: DashboardData['engagementTrends']['topEngagementActivities']
}

export function TopEngagementActivities({ activities }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Engagement Activities</CardTitle>
        <CardDescription>Activities driving highest engagement scores</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.slice(0, 8).map((activity, index) => (
            <div key={activity.activity} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-600">
                  {index + 1}
                </div>
                <span className="font-medium">{activity.activity.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{activity.averageScore}</div>
                <div className="text-xs text-gray-500">{formatNumber(activity.frequency)} times</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
