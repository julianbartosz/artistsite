// Performance Analytics API using standard Request/Response
import { PerformanceMonitor, type PerformanceMetrics } from '@domain/performance'

function json<T>(data: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  })
}

export async function POST(request: Request) {
  try {
    const performanceData = await request.json()
    const metrics: PerformanceMetrics = {
      ...performanceData,
      timestamp: performanceData.timestamp ? new Date(performanceData.timestamp) : new Date(),
    }
    await PerformanceMonitor.recordMetrics(metrics)
    return json({ success: true })
  } catch {
    return json({ error: 'Failed to process performance data' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const recommendations = await PerformanceMonitor.getOptimizationRecommendations()
    return json(recommendations)
  } catch {
    return json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}