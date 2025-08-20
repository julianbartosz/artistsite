import { SearchService } from '@/lib/search-recommendations';

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || query.length < 2) {
      return json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await SearchService.getSearchSuggestions(query, limit);

    return json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Search suggestions API error:', error);
    return json(
      { 
        success: false, 
        error: 'Failed to get suggestions',
        suggestions: []
      },
      { status: 500 }
    );
  }
}