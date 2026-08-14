import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CustomerInsights } from '@/lib/analytics/customer-insights'
import { requireAdmin } from '@/lib/auth'
import { ApiError } from '@/lib/api-error-handler'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Get basic analytics metrics
    const [
      totalEvents,
      totalCustomers,
      recentEvents,
      topEvents,
      segments,
      ltvAnalysis,
      engagementTrends
    ] = await Promise.all([
      // Total events count
      prisma.analyticsEvent.count(),
      
      // Total customer profiles
      prisma.customerProfile.count(),
      
      // Recent events (last 24 hours)
      prisma.analyticsEvent.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Top 10 events by frequency
      prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        _count: { eventName: true },
        orderBy: { _count: { eventName: 'desc' } },
        take: 10
      }),
      
      // Customer segments
      CustomerInsights.getCustomerSegmentsWithStats(),
      
      // LTV analysis
      CustomerInsights.calculateLifetimeValue(),
      
      // Engagement trends
      CustomerInsights.analyzeEngagementTrends()
    ])

    // Calculate conversion metrics
    const conversionData = await calculateConversionMetrics()
    
    // Get real-time metrics
    const realTimeMetrics = await getRealTimeMetrics()

    const dashboardData = {
      overview: {
        totalEvents,
        totalCustomers,
        recentEvents,
        conversionRate: conversionData.overallConversionRate,
        averageEngagement: engagementTrends.averageEngagement,
        averageLTV: ltvAnalysis.averageLTV
      },
      topEvents: topEvents.map(event => ({
        name: event.eventName,
        count: event._count.eventName
      })),
      segments: segments.slice(0, 6), // Top 6 segments for dashboard
      ltvAnalysis,
      engagementTrends,
      conversionData,
      realTimeMetrics,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    console.error('Analytics dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics dashboard data' },
      { status: 500 }
    )
  }
}

async function calculateConversionMetrics() {
  const [viewItemEvents, addToCartEvents, checkoutEvents, purchaseEvents] = await Promise.all([
    prisma.analyticsEvent.count({ where: { eventName: 'view_item' } }),
    prisma.analyticsEvent.count({ where: { eventName: 'add_to_cart' } }),
    prisma.analyticsEvent.count({ where: { eventName: 'begin_checkout' } }),
    prisma.analyticsEvent.count({ where: { eventName: 'purchase' } })
  ])

  const overallConversionRate = viewItemEvents > 0 ? (purchaseEvents / viewItemEvents) * 100 : 0
  const cartConversionRate = addToCartEvents > 0 ? (purchaseEvents / addToCartEvents) * 100 : 0
  const checkoutConversionRate = checkoutEvents > 0 ? (purchaseEvents / checkoutEvents) * 100 : 0

  return {
    overallConversionRate,
    cartConversionRate,
    checkoutConversionRate,
    funnelSteps: {
      views: viewItemEvents,
      cartAdds: addToCartEvents,
      checkouts: checkoutEvents,
      purchases: purchaseEvents
    }
  }
}

async function getRealTimeMetrics() {
  const last5Minutes = new Date(Date.now() - 5 * 60 * 1000)
  const last1Hour = new Date(Date.now() - 60 * 60 * 1000)

  const [recentEvents, activeUsers, recentPurchases] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { timestamp: { gte: last5Minutes } }
    }),
    prisma.analyticsEvent.findMany({
      where: { timestamp: { gte: last1Hour } },
      distinct: ['sessionId'],
      select: { sessionId: true }
    }).then(sessions => sessions.length),
    prisma.analyticsEvent.count({
      where: {
        eventName: 'purchase',
        timestamp: { gte: last1Hour }
      }
    })
  ])

  return {
    activeUsers,
    recentEvents,
    recentPurchases,
    lastUpdated: new Date().toISOString()
  }
}