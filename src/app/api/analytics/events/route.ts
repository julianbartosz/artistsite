import { z } from 'zod'
import { AnalyticsRepository } from '@domain/analytics'

const AnalyticsEventSchema = z.object({
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

function json<T>(data: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}), ...corsHeaders },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = AnalyticsEventSchema.parse(body)

    // Store the analytics event via repository
    const event = await AnalyticsRepository.createEvent({
      eventName: validatedData.event_name,
      userId: validatedData.user_id,
      sessionId: validatedData.session_id,
      properties: validatedData.properties,
      pageUrl: validatedData.page_url,
    })

    // Update customer profile if user_id exists
    if (validatedData.user_id) {
      await updateCustomerProfile(validatedData.user_id, validatedData.event_name, validatedData.properties)
    }

    return json({ 
      success: true, 
      eventId: event.id 
    }, { 
      status: 201,
    })
  } catch (error) {
    // Swallow error (tracking failure should not break app)
    if (error instanceof z.ZodError) {
      return json(
        { error: 'Invalid event data', details: error.issues },
        { 
          status: 400,
        }
      )
    }

    return json(
      { error: 'Failed to track analytics event' },
      { 
        status: 500,
      }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eventName = searchParams.get('event') || undefined
    const userId = searchParams.get('userId') || undefined
    const sessionId = searchParams.get('sessionId') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const events = await AnalyticsRepository.listEvents({ eventName, userId, sessionId, limit, offset })

    return json({
      events,
      total: events.length,
      hasMore: events.length === limit,
    })
  } catch {
    return json(
      { error: 'Failed to fetch analytics events' },
      { 
        status: 500,
      }
    )
  }
}

interface EventProperties {
  [key: string]: unknown
  value?: unknown
}

async function updateCustomerProfile(userId: string, eventName: string, properties: EventProperties) {
  try {
    // Find or create customer profile via repository
    let profile = await AnalyticsRepository.getCustomerProfile(userId)

    if (!profile) {
      profile = await AnalyticsRepository.createCustomerProfile(userId)
    }

    // Update engagement score based on event type
    const engagementBonus = calculateEngagementBonus(eventName)
    const newEngagementScore = Math.min(profile.engagementScore + engagementBonus, 1000)

    // Update lifetime value for purchase events
    let newLifetimeValue = profile.lifetimeValue
    if (eventName === 'purchase' && properties.value) {
      newLifetimeValue += parseFloat(String(properties.value)) || 0
    }

    // Update segments based on behavior
    const currentSegments = parseSegments(profile.segments)
    const newSegments = updateUserSegments(currentSegments, eventName, properties)

    // Update the profile via repository
    await AnalyticsRepository.updateCustomerProfile(userId, {
      engagementScore: newEngagementScore,
      lifetimeValue: newLifetimeValue,
      segments: newSegments,
    })
  } catch {
    // ignore profile update errors
  }
}

function calculateEngagementBonus(eventName: string): number {
  const engagementValues: Record<string, number> = {
    'page_view': 1,
    'view_item': 2,
    'add_to_cart': 5,
    'begin_checkout': 8,
    'purchase': 15,
    'newsletter_signup': 10,
    'contact_form_submit': 12,
    'portfolio_view': 3,
    'artwork_view': 4,
    'social_share': 6,
    'blog_read': 3,
    'search': 2,
    'wishlist_add': 4,
  }

  return engagementValues[eventName] || 1
}

function parseSegments(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : []
  } catch {
    return []
  }
}

function updateUserSegments(currentSegments: string[], eventName: string, properties: EventProperties): string[] {
  const segments = new Set(currentSegments)

  // Behavioral segments
  if (eventName === 'purchase') {
    segments.add('customer')
    if (properties.value && parseFloat(String(properties.value)) > 500) {
      segments.add('high_value_customer')
    }
  }

  if (eventName === 'add_to_cart') {
    segments.add('active_shopper')
  }

  if (eventName === 'newsletter_signup') {
    segments.add('newsletter_subscriber')
  }

  if (eventName === 'portfolio_view' || eventName === 'artwork_view') {
    segments.add('art_enthusiast')
  }

  if (eventName === 'contact_form_submit' || eventName === 'commission_inquiry') {
    segments.add('potential_client')
  }

  // Remove temporary segments that may no longer apply
  if (eventName === 'purchase') {
    segments.delete('cart_abandoner')
  }

  return Array.from(segments)
}