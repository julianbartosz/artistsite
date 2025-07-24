import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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
    const body = await request.json()
    const validatedData = EventSchema.parse(body)

    // Store the event
    const event = await prisma.analyticsEvent.create({
      data: {
        eventName: validatedData.event_name,
        userId: validatedData.user_id,
        sessionId: validatedData.session_id,
        properties: JSON.stringify(validatedData.properties),
        pageUrl: validatedData.page_url,
        timestamp: new Date(),
      },
    })

    // Update customer profile if user_id exists
    if (validatedData.user_id) {
      await updateCustomerProfile(validatedData.user_id, validatedData.event_name, validatedData.properties)
    }

    return NextResponse.json({ 
      success: true, 
      eventId: event.id 
    }, { 
      status: 201,
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

    // Handle Prisma/database errors gracefully
    if (error instanceof Error && error.message.includes('DATABASE')) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable' },
        { 
          status: 503,
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

interface EventProperties {
  [key: string]: unknown
}

async function updateCustomerProfile(userId: string, eventName: string, properties: EventProperties) {
  try {
    // Find or create customer profile
    let profile = await prisma.customerProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      // Create new profile
      profile = await prisma.customerProfile.create({
        data: {
          id: userId,
          segments: JSON.stringify([]),
          behaviorScore: 0,
          preferences: JSON.stringify({}),
          lifetimeValue: 0,
          engagementScore: 0,
          lastActivity: new Date(),
        },
      })
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
    const currentSegments = JSON.parse(profile.segments)
    const newSegments = updateUserSegments(currentSegments, eventName, properties)

    // Update the profile
    await prisma.customerProfile.update({
      where: { id: userId },
      data: {
        engagementScore: newEngagementScore,
        lifetimeValue: newLifetimeValue,
        segments: JSON.stringify(newSegments),
        lastActivity: new Date(),
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Customer profile update error:', error)
    }
    // Don't throw - event should still be recorded
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