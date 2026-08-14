import { Product } from './commerce';
import { 
  SearchFilters, 
  SortOption, 
  SearchResults, 
  RecommendationType, 
  RecommendationResult
} from './types';
import { getAllProducts } from './commerce-server';
import { prisma } from '@/lib/db';

export class SearchService {
  /**
   * Advanced product search with filtering and sorting
   */
  static async searchProducts(
    query: string,
    filters: SearchFilters = {},
    sortBy: SortOption = 'relevance',
    page: number = 1,
    limit: number = 12,
    userId?: string,
    sessionId?: string
  ): Promise<SearchResults> {
    const startTime = Date.now();
    
    try {
      // Get all products
      const allProducts = await getAllProducts();
      
      // Apply text search
      let filteredProducts = query.trim() 
        ? this.filterByQuery(allProducts, query)
        : allProducts;

      // Apply filters
      filteredProducts = this.applyFilters(filteredProducts, filters);

      // Apply sorting
      const sortedProducts = await this.applySorting(filteredProducts, sortBy);

      // Pagination
      const startIndex = (page - 1) * limit;
      const paginatedProducts = sortedProducts.slice(startIndex, startIndex + limit);

      // Log search query for analytics
      if (query.trim()) {
        await this.logSearchQuery(query, filters, sortBy, filteredProducts.length, userId, sessionId);
      }

      const searchTime = Date.now() - startTime;

      return {
        products: paginatedProducts,
        totalResults: filteredProducts.length,
        searchTime,
        filters,
        sortBy,
        suggestions: this.generateSuggestions(query, allProducts)
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        products: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        filters,
        sortBy
      };
    }
  }

  /**
   * Get autocomplete suggestions for search
   */
  static async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) return [];

    try {
      const products = await getAllProducts();
      const suggestions = new Set<string>();

      // Search in titles
      products.forEach(product => {
        const title = product.title.toLowerCase();
        if (title.includes(query.toLowerCase())) {
          suggestions.add(product.title);
        }
        
        // Search in categories
        if (product.category.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(product.category);
        }

        // Search in medium
        if (product.medium?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(product.medium);
        }
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  /**
   * Filter products by search query
   */
  private static filterByQuery(products: Product[], query: string): Product[] {
    const searchTerms = query.toLowerCase().trim().split(' ');
    
    return products.filter(product => {
      const searchableText = [
        product.title,
        product.description,
        product.category,
        product.medium,
        ...(product.tags || [])
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  /**
   * Apply filters to products
   */
  private static applyFilters(products: Product[], filters: SearchFilters): Product[] {
    let filtered = [...products];

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(product => 
        filters.categories!.includes(product.category)
      );
    }

    // Price range filter
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      filtered = filtered.filter(product => 
        product.price >= min && product.price <= max
      );
    }

    // Medium filter
    if (filters.medium && filters.medium.length > 0) {
      filtered = filtered.filter(product => 
        product.medium && filters.medium!.includes(product.medium)
      );
    }

    // Dimensions filter (simplified)
    if (filters.dimensions && filters.dimensions.length > 0) {
      filtered = filtered.filter(product => {
        if (!product.dimensions) return false;
        const size = this.categorizeSize(product.dimensions);
        return filters.dimensions!.includes(size);
      });
    }

    return filtered;
  }

  /**
   * Apply sorting to products
   */
  private static async applySorting(products: Product[], sortBy: SortOption): Promise<Product[]> {
    const sorted = [...products];

    switch (sortBy) {
      case 'price_low_high':
        return sorted.sort((a, b) => a.price - b.price);
      
      case 'price_high_low':
        return sorted.sort((a, b) => b.price - a.price);
      
      case 'newest':
        return sorted.sort((a, b) => {
          // Assuming products have a createdAt field or we use ID as proxy
          return b.id.localeCompare(a.id);
        });
      
      case 'popularity':
        return this.sortByPopularity(sorted);
      
      case 'relevance':
      default:
        return sorted; // Already sorted by relevance in filterByQuery
    }
  }

  /**
   * Sort products by popularity score
   */
  private static async sortByPopularity(products: Product[]): Promise<Product[]> {
    try {
      // Get analytics for all products
      const analytics = await prisma.productAnalytics.findMany({
        where: {
          productId: { in: products.map(p => p.id) }
        }
      });

      const analyticsMap = new Map(analytics.map(a => [a.productId, a]));

      return products.sort((a, b) => {
        const aScore = analyticsMap.get(a.id)?.popularityScore || 0;
        const bScore = analyticsMap.get(b.id)?.popularityScore || 0;
        return bScore - aScore;
      });
    } catch (error) {
      console.error('Popularity sorting error:', error);
      return products;
    }
  }

  /**
   * Generate search suggestions based on query
   */
  private static generateSuggestions(query: string, products: Product[]): string[] {
    if (!query || query.length < 2) return [];

    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();

    // Add category suggestions
    products.forEach(product => {
      if (product.category.toLowerCase().includes(lowerQuery)) {
        suggestions.add(product.category);
      }
    });

    // Add popular search terms (could be enhanced with ML)
    const popularTerms = ['abstract', 'landscape', 'portrait', 'modern', 'contemporary'];
    popularTerms.forEach(term => {
      if (term.includes(lowerQuery)) {
        suggestions.add(term);
      }
    });

    return Array.from(suggestions).slice(0, 5);
  }

  /**
   * Categorize product size for filtering
   */
  private static categorizeSize(dimensions: string): string {
    const sizeMatch = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (!sizeMatch) return 'unknown';

    const width = parseInt(sizeMatch[1]);
    const height = parseInt(sizeMatch[2]);
    const area = width * height;

    if (area < 400) return 'small';
    if (area < 1200) return 'medium';
    return 'large';
  }

  /**
   * Log search query for analytics
   */
  private static async logSearchQuery(
    query: string,
    filters: SearchFilters,
    sortBy: SortOption,
    resultCount: number,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      await prisma.searchQuery.create({
        data: {
          query,
          userId,
          sessionId,
          resultCount,
          filters: filters as any,
          sortBy,
          source: 'manual'
        }
      });
    } catch (error) {
      console.error('Failed to log search query:', error);
    }
  }
}

export class RecommendationService {
  /**
   * Get product recommendations for a given product
   */
  static async getProductRecommendations(
    productId: string,
    types: RecommendationType[] = ['similar', 'frequently_bought_together'],
    limit: number = 4
  ): Promise<RecommendationResult[]> {
    try {
      const results: RecommendationResult[] = [];

      for (const type of types) {
        const recommendations = await this.getRecommendationsByType(productId, type, limit);
        if (recommendations.products.length > 0) {
          results.push(recommendations);
        }
      }

      return results;
    } catch (error) {
      console.error('Recommendation error:', error);
      return [];
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  static async getPersonalizedRecommendations(
    userId: string,
    limit: number = 8
  ): Promise<Product[]> {
    try {
      // Get user's view history and purchases
      const [viewHistory, orders] = await Promise.all([
        prisma.productView.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20
        }),
        prisma.order.findMany({
          where: { userId },
          include: { items: true }
        })
      ]);

      // Extract product IDs from history
      const viewedProductIds = viewHistory.map(v => v.productId);
      const purchasedProductIds = orders.flatMap(o => o.items.map(i => i.productId));

      // Get products for analysis
      const allProducts = await getAllProducts();
      const viewedProducts = allProducts.filter(p => viewedProductIds.includes(p.id));

      // Generate recommendations based on user behavior
      const recommendations = await this.generatePersonalizedRecommendations(
        viewedProducts,
        purchasedProductIds,
        allProducts,
        limit
      );

      return recommendations;
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      return [];
    }
  }

  /**
   * Track product view for analytics and recommendations
   */
  static async trackProductView(
    productId: string,
    userId?: string,
    sessionId?: string,
    source?: string,
    duration?: number
  ): Promise<void> {
    try {
      // Log the view
      await prisma.productView.create({
        data: {
          productId,
          userId,
          sessionId,
          source,
          duration
        }
      });

      // Update analytics
      await this.updateProductAnalytics(productId, 'view');
    } catch (error) {
      console.error('Failed to track product view:', error);
    }
  }

  /**
   * Get recommendations by type
   */
  private static async getRecommendationsByType(
    productId: string,
    type: RecommendationType,
    limit: number
  ): Promise<RecommendationResult> {
    switch (type) {
      case 'similar':
        return this.getSimilarProducts(productId, limit);
      
      case 'frequently_bought_together':
        return this.getFrequentlyBoughtTogether(productId, limit);
      
      case 'viewed_together':
        return this.getViewedTogether(productId, limit);
      
      default:
        return {
          type,
          products: [],
          reason: 'No recommendations available',
          score: 0
        };
    }
  }

  /**
   * Get similar products based on category and attributes
   */
  private static async getSimilarProducts(productId: string, limit: number): Promise<RecommendationResult> {
    try {
      const allProducts = await getAllProducts();
      const sourceProduct = allProducts.find(p => p.id === productId);
      
      if (!sourceProduct) {
        return { type: 'similar', products: [], reason: 'Product not found', score: 0 };
      }

      // Find similar products
      const similar = allProducts
        .filter(p => p.id !== productId)
        .map(p => ({
          product: p,
          score: this.calculateSimilarityScore(sourceProduct, p)
        }))
        .filter(item => item.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.product);

      return {
        type: 'similar',
        products: similar,
        reason: `Similar ${sourceProduct.category.toLowerCase()} artworks`,
        score: similar.length > 0 ? 0.8 : 0
      };
    } catch (error) {
      console.error('Similar products error:', error);
      return { type: 'similar', products: [], reason: 'Error finding similar products', score: 0 };
    }
  }

  /**
   * Calculate similarity score between two products
   */
  private static calculateSimilarityScore(product1: Product, product2: Product): number {
    let score = 0;

    // Category match (high weight)
    if (product1.category === product2.category) score += 0.4;

    // Medium match (medium weight)
    if (product1.medium === product2.medium) score += 0.3;

    // Price similarity (low weight)
    const priceDiff = Math.abs(product1.price - product2.price);
    const avgPrice = (product1.price + product2.price) / 2;
    const priceScore = Math.max(0, 1 - (priceDiff / avgPrice));
    score += priceScore * 0.2;

    // Tag overlap (medium weight)
    if (product1.tags && product2.tags) {
      const overlap = product1.tags.filter(tag => product2.tags!.includes(tag)).length;
      const totalTags = new Set([...product1.tags, ...product2.tags]).size;
      score += (overlap / totalTags) * 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Get frequently bought together products
   */
  private static async getFrequentlyBoughtTogether(productId: string, limit: number): Promise<RecommendationResult> {
    try {
      // Query orders that contain the source product
      const ordersWithProduct = await prisma.order.findMany({
        where: {
          items: {
            some: { productId }
          }
        },
        include: { items: true }
      });

      // Count co-occurrences
      const coOccurrences = new Map<string, number>();
      
      ordersWithProduct.forEach(order => {
        order.items.forEach(item => {
          if (item.productId !== productId) {
            coOccurrences.set(
              item.productId,
              (coOccurrences.get(item.productId) || 0) + 1
            );
          }
        });
      });

      // Get top co-occurring products
      const sortedCoOccurrences = Array.from(coOccurrences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get product details
      const allProducts = await getAllProducts();
      const products = sortedCoOccurrences
        .map(([productId]) => allProducts.find(p => p.id === productId))
        .filter(Boolean) as Product[];

      return {
        type: 'frequently_bought_together',
        products,
        reason: 'Customers who bought this item also bought',
        score: products.length > 0 ? 0.9 : 0
      };
    } catch (error) {
      console.error('Frequently bought together error:', error);
      return { 
        type: 'frequently_bought_together', 
        products: [], 
        reason: 'Error finding related products', 
        score: 0 
      };
    }
  }

  /**
   * Get products viewed together
   */
  private static async getViewedTogether(productId: string, limit: number): Promise<RecommendationResult> {
    try {
      // Get sessions that viewed this product
      const viewSessions = await prisma.productView.findMany({
        where: { productId },
        select: { sessionId: true, userId: true },
        distinct: ['sessionId', 'userId']
      });

      // Get other products viewed in same sessions
      const sessionIds = viewSessions.map(v => v.sessionId).filter(Boolean) as string[];
      const userIds = viewSessions.map(v => v.userId).filter(Boolean) as string[];

      const relatedViews = await prisma.productView.findMany({
        where: {
          AND: [
            { productId: { not: productId } },
            {
              OR: [
                { sessionId: { in: sessionIds } },
                { userId: { in: userIds } }
              ]
            }
          ]
        }
      });

      // Count view co-occurrences
      const viewCounts = new Map<string, number>();
      relatedViews.forEach(view => {
        viewCounts.set(
          view.productId,
          (viewCounts.get(view.productId) || 0) + 1
        );
      });

      // Get top viewed products
      const sortedViews = Array.from(viewCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get product details
      const allProducts = await getAllProducts();
      const products = sortedViews
        .map(([productId]) => allProducts.find(p => p.id === productId))
        .filter(Boolean) as Product[];

      return {
        type: 'viewed_together',
        products,
        reason: 'People who viewed this also viewed',
        score: products.length > 0 ? 0.7 : 0
      };
    } catch (error) {
      console.error('Viewed together error:', error);
      return { 
        type: 'viewed_together', 
        products: [], 
        reason: 'Error finding related products', 
        score: 0 
      };
    }
  }

  /**
   * Generate personalized recommendations
   */
  private static async generatePersonalizedRecommendations(
    viewedProducts: Product[],
    purchasedProductIds: string[],
    allProducts: Product[],
    limit: number
  ): Promise<Product[]> {
    // Extract user preferences from behavior
    const categoryPreferences = new Map<string, number>();
    const mediumPreferences = new Map<string, number>();

    viewedProducts.forEach(product => {
      categoryPreferences.set(
        product.category,
        (categoryPreferences.get(product.category) || 0) + 1
      );
      
      if (product.medium) {
        mediumPreferences.set(
          product.medium,
          (mediumPreferences.get(product.medium) || 0) + 1
        );
      }
    });

    // Score products based on preferences
    const scoredProducts = allProducts
      .filter(p => 
        !viewedProducts.some(v => v.id === p.id) && 
        !purchasedProductIds.includes(p.id)
      )
      .map(product => ({
        product,
        score: this.calculatePersonalizationScore(
          product,
          categoryPreferences,
          mediumPreferences
        )
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.product);

    return scoredProducts;
  }

  /**
   * Calculate personalization score
   */
  private static calculatePersonalizationScore(
    product: Product,
    categoryPreferences: Map<string, number>,
    mediumPreferences: Map<string, number>
  ): number {
    let score = 0;

    // Category preference
    const categoryScore = categoryPreferences.get(product.category) || 0;
    score += categoryScore * 0.6;

    // Medium preference
    const mediumScore = product.medium ? (mediumPreferences.get(product.medium) || 0) : 0;
    score += mediumScore * 0.4;

    return score;
  }

  /**
   * Update product analytics
   */
  private static async updateProductAnalytics(
    productId: string,
    action: 'view' | 'cart_add' | 'wishlist_add' | 'purchase'
  ): Promise<void> {
    try {
      const updateData: any = {};

      switch (action) {
        case 'view':
          updateData.totalViews = { increment: 1 };
          break;
        case 'cart_add':
          updateData.cartAdds = { increment: 1 };
          break;
        case 'wishlist_add':
          updateData.wishlistAdds = { increment: 1 };
          break;
        case 'purchase':
          updateData.purchases = { increment: 1 };
          break;
      }

      await prisma.productAnalytics.upsert({
        where: { productId },
        update: updateData,
        create: {
          productId,
          ...Object.keys(updateData).reduce((acc, key) => {
            acc[key] = 1;
            return acc;
          }, {} as any)
        }
      });

      // Recalculate popularity score
      await this.recalculatePopularityScore(productId);
    } catch (error) {
      console.error('Failed to update analytics:', error);
    }
  }

  /**
   * Recalculate popularity score for a product
   */
  private static async recalculatePopularityScore(productId: string): Promise<void> {
    try {
      const analytics = await prisma.productAnalytics.findUnique({
        where: { productId }
      });

      if (!analytics) return;

      // Calculate popularity score based on various metrics
      const viewWeight = 0.1;
      const cartWeight = 0.3;
      const wishlistWeight = 0.2;
      const purchaseWeight = 0.4;

      const popularityScore = 
        (analytics.totalViews * viewWeight) +
        (analytics.cartAdds * cartWeight) +
        (analytics.wishlistAdds * wishlistWeight) +
        (analytics.purchases * purchaseWeight);

      // Normalize score (this is a simplified version)
      const normalizedScore = Math.min(popularityScore / 100, 1);

      await prisma.productAnalytics.update({
        where: { productId },
        data: { 
          popularityScore: normalizedScore,
          lastCalculated: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to recalculate popularity score:', error);
    }
  }
}