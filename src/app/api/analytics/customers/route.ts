import { Marketing } from '@/domain/marketing'

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCustomers = searchParams.get('includeCustomers') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get customer segments - returns string[] not objects
    const segments = await Marketing.insights.getCustomerSegments()

    // Optionally include customer details for each segment
    if (includeCustomers) {
      const segmentsWithCustomers = await Promise.all(
        segments.map(async (segmentName) => ({
          id: segmentName,
          name: segmentName,
          customers: await Marketing.insights.getSegmentCustomers(segmentName, limit),
        }))
      )

      return json({ segments: segmentsWithCustomers })
    }

    // Transform string segments to objects for consistent API response
    const segmentObjects = segments.map(segmentName => ({
      id: segmentName,
      name: segmentName
    }))

    return json({ segments: segmentObjects })
  } catch (error) {
    return json(
      { error: `Failed to fetch customer segments: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}