import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recordAnalyticsEvent } from '@/lib/analytics/customer-insights'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { ApiError } from '@/lib/api-error-handler'

const AnalyticsEventSchema = z.object({
  event_name: z.string().min(1).max(100),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  properties: z.record(z.string(), z.any()).default({}),
  page_url: z.string().url().optional(),
})

// Add CORS headers to handle cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = AnalyticsEventSchema.parse(body)

    const result = await recordAnalyticsEvent({
      eventName: validatedData.event_name,
      userId: validatedData.user_id,
      sessionId: validatedData.session_id,
      properties: validatedData.properties,
      pageUrl: validatedData.page_url,
    })

    return NextResponse.json({ 
      success: true,
      stored: result.stored,
      eventId: result.eventId,
    }, { 
      status: result.stored ? 201 : 202,
      headers: corsHeaders,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics event tracking error:', error)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.issues },
        { 
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    return NextResponse.json(
      { error: 'Failed to track analytics event' },
      { 
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const eventName = searchParams.get('event')
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    interface WhereClause {
      eventName?: string
      userId?: string
      sessionId?: string
    }

    const where: WhereClause = {}
    if (eventName) where.eventName = eventName
    if (userId) where.userId = userId
    if (sessionId) where.sessionId = sessionId

    const events = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000 for performance
      skip: offset,
      select: {
        id: true,
        eventName: true,
        userId: true,
        sessionId: true,
        properties: true,
        timestamp: true,
        pageUrl: true,
      },
    })

    // Parse properties JSON
    const formattedEvents = events.map(event => ({
      ...event,
      properties: JSON.parse(event.properties || '{}'),
    }))

    return NextResponse.json({
      events: formattedEvents,
      total: events.length,
      hasMore: events.length === limit,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics events fetch error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch analytics events' },
      { status: 500 }
    )
  }
}
