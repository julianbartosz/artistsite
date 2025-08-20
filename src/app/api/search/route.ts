import { SearchService } from '@/lib/search-recommendations';
import { SearchFilters, SortOption } from '@/lib/types';

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract search parameters
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const sortBy = (searchParams.get('sort') || 'relevance') as SortOption;
    const userId = searchParams.get('userId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;

    // Parse filters
    const filters: SearchFilters = {};
    
    const categories = searchParams.get('categories');
    if (categories) {
      filters.categories = categories.split(',');
    }

    const medium = searchParams.get('medium');
    if (medium) {
      filters.medium = medium.split(',');
    }

    const dimensions = searchParams.get('dimensions');
    if (dimensions) {
      filters.dimensions = dimensions.split(',');
    }

    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    if (priceMin || priceMax) {
      filters.priceRange = {
        min: priceMin ? parseFloat(priceMin) : 0,
        max: priceMax ? parseFloat(priceMax) : 10000
      };
    }

    const availability = searchParams.get('availability');
    if (availability === 'in_stock') {
      filters.availability = 'in_stock';
    }

    // Perform search
    const results = await SearchService.searchProducts(
      query,
      filters,
      sortBy,
      page,
      limit,
      userId,
      sessionId
    );

    return json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Search API error:', error);
    return json(
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