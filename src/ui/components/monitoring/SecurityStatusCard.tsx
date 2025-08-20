import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import { Badge } from '@ui/components/ui/badge'
import type { SecurityStatus } from './types'

interface Props {
  securityStatus: SecurityStatus | null
}

export function SecurityStatusCard({ securityStatus }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Status</CardTitle>
      </CardHeader>
      <CardContent>
        {securityStatus ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Overall Security Score:</span>
              <Badge variant={securityStatus.overallScore >= 80 ? 'default' : 'destructive'}>
                {securityStatus.overallScore}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Critical Issues:</span>
              <Badge variant={securityStatus.criticalIssues === 0 ? 'default' : 'destructive'}>
                {securityStatus.criticalIssues}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Last Audit:</span>
              <span className="font-semibold">{new Date(securityStatus.lastAudit).toLocaleString()}</span>
            </div>

            {securityStatus.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {securityStatus.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p>No security data available</p>
        )}
      </CardContent>
    </Card>
  )
}
