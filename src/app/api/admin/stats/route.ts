import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Mock data - replace with actual database queries
const mockStats = {
  totalPosts: 12,
  publishedPosts: 8,
  draftPosts: 4,
  totalProducts: 24,
  totalViews: 15432,
  monthlyViews: 3287,
};

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function GET(_request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    return json(mockStats, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes cache
      },
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}