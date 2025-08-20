import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'

export function PerformanceTrendsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Performance charts would be displayed here
        </div>
      </CardContent>
    </Card>
  )
}
