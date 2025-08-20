import { Metadata } from 'next'
import AnalyticsDashboard from '@ui/components/analytics/AnalyticsDashboard'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Analytics Dashboard - Artist Site',
  description: 'Real-time analytics and customer insights for the artist marketplace',
  robots: { index: false, follow: false }, // Private admin page
}

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      }>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  )
}