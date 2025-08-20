import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/components/ui/card'
import type { DashboardData } from './types'
import { formatNumber } from './format'

interface Props {
  funnel: DashboardData['conversionData']['funnelSteps']
}

export function ConversionFunnel({ funnel }: Props) {
  const steps = [
    { name: 'Product Views', count: funnel.views, rate: 100 },
    {
      name: 'Add to Cart',
      count: funnel.cartAdds,
      rate: funnel.views > 0 ? (funnel.cartAdds / funnel.views) * 100 : 0
    },
    {
      name: 'Begin Checkout',
      count: funnel.checkouts,
      rate: funnel.views > 0 ? (funnel.checkouts / funnel.views) * 100 : 0
    },
    {
      name: 'Purchase',
      count: funnel.purchases,
      rate: funnel.views > 0 ? (funnel.purchases / funnel.views) * 100 : 0
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-commerce Conversion Funnel</CardTitle>
        <CardDescription>Customer journey from view to purchase</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.name} className="flex items-center space-x-4">
              <div className="w-32 text-sm font-medium">{step.name}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                <div
                  className="bg-blue-600 h-6 rounded-full transition-all duration-300"
                  style={{ width: `${step.rate}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  {formatNumber(step.count)} ({step.rate.toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
