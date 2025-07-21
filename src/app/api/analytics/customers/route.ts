import { NextRequest, NextResponse } from 'next/server'
import { CustomerInsights } from '@/lib/analytics/customer-insights'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCustomers = searchParams.get('includeCustomers') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get customer segments
    const segments = await CustomerInsights.getCustomerSegments()

    // Optionally include customer details for each segment
    if (includeCustomers) {
      const segmentsWithCustomers = await Promise.all(
        segments.map(async (segment) => ({
          ...segment,
          customers: await CustomerInsights.getSegmentCustomers(segment.id, limit),
        }))
      )
      return NextResponse.json({ segments: segmentsWithCustomers })
    }

    return NextResponse.json({ segments })

  } catch (error) {
    console.error('Customer segments fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer segments' },
      { status: 500 }
    )
  }
}