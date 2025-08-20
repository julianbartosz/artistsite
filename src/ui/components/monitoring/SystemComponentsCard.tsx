import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import { Badge } from '@ui/components/ui/badge'
import type { SystemHealth } from './types'
import { getHealthBadgeColor } from './status'

interface Props {
  systemHealth: SystemHealth | null
}

export function SystemComponentsCard({ systemHealth }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Components</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {systemHealth ? (
          <>
            <div className="flex justify-between items-center">
              <span>Database:</span>
              <Badge className={getHealthBadgeColor(systemHealth.database)}>
                {systemHealth.database}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>API:</span>
              <Badge className={getHealthBadgeColor(systemHealth.api)}>
                {systemHealth.api}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Cache:</span>
              <Badge className={getHealthBadgeColor(systemHealth.cache)}>
                {systemHealth.cache}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="font-semibold">{systemHealth.uptime}</span>
            </div>
          </>
        ) : (
          <p>No health data available</p>
        )}
      </CardContent>
    </Card>
  )
}
