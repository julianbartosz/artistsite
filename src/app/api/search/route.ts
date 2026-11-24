import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/search-recommendations';
import { parseProductSearchParams } from '@/lib/search-params';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, page, limit, sortBy, filters, userId, sessionId } =
      parseProductSearchParams(searchParams);

    const results = await SearchService.searchProducts(
      query,
      filters,
      sortBy,
      page,
      limit,
      userId,
      sessionId
    );

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search failed',
        products: [],
        totalResults: 0,
        searchTime: 0
      },
      { status: 500 }
    );
  }
}