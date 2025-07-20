import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/search-recommendations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await SearchService.getSearchSuggestions(query, limit);

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Search suggestions API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get suggestions',
        suggestions: []
      },
      { status: 500 }
    );
  }
}