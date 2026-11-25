import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdminEmailResolved } from '@/lib/auth'
import { recordAnalyticsEvent, shouldIgnoreAnalyticsPageUrl } from '@/lib/analytics/customer-insights'
import { COLLECTOR_PROFILE_COOKIE, verifyCollectorProfileToken } from '@/lib/newsletter-subscribers'
import { z } from 'zod'

const EventSchema = z.object({
  event_name: z.string().min(1).max(100),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  properties: z.record(z.string(), z.any()).default({}),
  page_url: z.string().url().optional(),
})

// Add CORS headers to handle cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const rawBody = await request.text()
    if (!rawBody.trim()) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const body = JSON.parse(rawBody)
    const validatedData = EventSchema.parse(body)

    const referer = request.headers.get('referer')
    if (shouldIgnoreAnalyticsPageUrl(validatedData.page_url) || shouldIgnoreAnalyticsPageUrl(referer)) {
      return NextResponse.json(
        { success: true, stored: false, ignored: true },
        { status: 202, headers: corsHeaders }
      )
    }

    const session = await getServerSession(authOptions)
    if (session?.user?.isAdmin || (session?.user?.email && await isAdminEmailResolved(session.user.email))) {
      return NextResponse.json(
        { success: true, stored: false, ignored: true },
        { status: 202, headers: corsHeaders }
      )
    }

    const cookieProfileId = verifyCollectorProfileToken(request.cookies.get(COLLECTOR_PROFILE_COOKIE)?.value)
    const result = await recordAnalyticsEvent({
      eventName: validatedData.event_name,
      userId: session?.user?.id ?? cookieProfileId ?? validatedData.user_id,
      email: session?.user?.email ?? undefined,
      sessionId: validatedData.session_id,
      properties: validatedData.properties,
      pageUrl: validatedData.page_url,
    })

    return NextResponse.json({ 
      success: true,
      stored: result.stored,
      eventId: result.eventId,
      ignored: result.ignored,
    }, { 
      status: result.stored ? 201 : 202,
      headers: corsHeaders,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Event tracking error:', error)
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
      { error: 'Failed to track event' },
      { 
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}