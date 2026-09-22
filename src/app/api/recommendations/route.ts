import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RecommendationService } from '@/lib/search-recommendations';
import { RecommendationType } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const types = searchParams.get('types')?.split(',') as RecommendationType[] || ['similar'];
    const limit = parseInt(searchParams.get('limit') || '4');

    let recommendations;

    if (productId) {
      recommendations = await RecommendationService.getProductRecommendations(
        productId,
        types,
        limit
      );
    } else {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        const personalizedProducts = await RecommendationService.getPersonalizedRecommendations(
          session.user.id,
          limit
        );
        recommendations = [{
          type: 'personalized' as RecommendationType,
          products: personalizedProducts,
          reason: 'Recommended for you',
          score: 0.9,
        }];
      } else {
        recommendations = await RecommendationService.getPopularRecommendations(limit);
      }
    }

    return NextResponse.json({
      success: true,
      recommendations
    });

  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get recommendations',
        recommendations: []
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json(
        { success: false, error: 'Request body is required' },
        { status: 400 }
      );
    }

    const body = JSON.parse(rawBody);
    const { productId, sessionId, source, duration } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    await RecommendationService.trackProductView(
      productId,
      session?.user?.id,
      sessionId,
      source,
      duration
    );

    return NextResponse.json({
      success: true,
      message: 'Product view tracked successfully'
    });

  } catch (error) {
    console.error('Product view tracking error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to track product view'
      },
      { status: 500 }
    );
  }
}