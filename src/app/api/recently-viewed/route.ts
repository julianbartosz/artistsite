import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAllProducts } from '@/lib/commerce';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '6');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get recently viewed products from database
    const recentViews = await prisma.productView.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Get more to filter out duplicates
      select: {
        productId: true,
        createdAt: true
      }
    });

    // Remove duplicates and get unique product IDs
    const uniqueProductIds = [...new Set(recentViews.map(view => view.productId))];
    const limitedProductIds = uniqueProductIds.slice(0, limit);

    // Get product details
    const allProducts = getAllProducts();
    const products = limitedProductIds
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Recently viewed API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get recently viewed products',
        products: []
      },
      { status: 500 }
    );
  }
}