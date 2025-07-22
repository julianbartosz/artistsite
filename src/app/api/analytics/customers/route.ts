import { NextRequest, NextResponse } from 'next/server'
import { CustomerInsights } from '@/lib/analytics/customer-insights'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCustomers = searchParams.get('includeCustomers') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get customer segments - returns string[] not objects
    const segments = await CustomerInsights.getCustomerSegments()

    // Optionally include customer details for each segment
    if (includeCustomers) {
      const segmentsWithCustomers = await Promise.all(
        segments.map(async (segmentName) => ({
          id: segmentName,
          name: segmentName,
          customers: await CustomerInsights.getSegmentCustomers(segmentName, limit),
        }))
      )

      return NextResponse.json({ segments: segmentsWithCustomers })
    }

    // Transform string segments to objects for consistent API response
    const segmentObjects = segments.map(segmentName => ({
      id: segmentName,
      name: segmentName
    }))

    return NextResponse.json({ segments: segmentObjects })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch customer segments: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}