import { RecommendationService } from '@/lib/search-recommendations'
import { RecommendationType } from '@/lib/types'

// JSON helper
function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const userId = searchParams.get('userId')
    const types = (searchParams.get('types')?.split(',') as RecommendationType[]) || ['similar']
    const limit = parseInt(searchParams.get('limit') || '4')
    if (!productId && !userId) return json({ error: 'Either productId or userId is required' }, { status: 400 })
    let recommendations
    if (productId) {
      recommendations = await RecommendationService.getProductRecommendations(productId, types, limit)
    } else {
      const personalizedProducts = await RecommendationService.getPersonalizedRecommendations(userId as string, limit)
      recommendations = [{ type: 'personalized' as RecommendationType, products: personalizedProducts, reason: 'Recommended for you', score: 0.9 }]
    }
    return json({ success: true, recommendations })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return json({ success: false, error: 'Failed to get recommendations', recommendations: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { productId, userId, sessionId, source, duration } = await request.json()
    if (!productId) return json({ error: 'productId is required' }, { status: 400 })
    await RecommendationService.trackProductView(productId, userId, sessionId, source, duration)
    return json({ success: true, message: 'Product view tracked successfully' })
  } catch (error) {
    console.error('Product view tracking error:', error)
    return json({ success: false, error: 'Failed to track product view' }, { status: 500 })
  }
}