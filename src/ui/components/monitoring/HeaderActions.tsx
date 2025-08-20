import { Button } from '@ui/components/ui/button'

interface Props {
  loading: boolean
  onSecurityAudit: () => void
  onPerformanceTest: () => void
}

export function HeaderActions({ loading, onSecurityAudit, onPerformanceTest }: Props) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">System Monitoring Dashboard</h1>
      <div className="flex gap-2">
        <Button onClick={onSecurityAudit} disabled={loading}>
          Run Security Audit
        </Button>
        <Button onClick={onPerformanceTest} disabled={loading} variant="outline">
          Run Performance Test
        </Button>
      </div>
    </div>
  )
}
