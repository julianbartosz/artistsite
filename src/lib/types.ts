// ...existing code...

// New interfaces for Phase 4: Advanced Catalog Features
import { Product } from './commerce';

export interface ProductView {
  id: string;
  userId?: string;
  productId: string;
  sessionId?: string;
  source?: 'search' | 'recommendation' | 'category' | 'direct';
  referrer?: string;
  duration?: number;
  createdAt: Date;
}

export interface ProductAnalytics {
  id: string;
  productId: string;
  totalViews: number;
  uniqueViews: number;
  avgViewTime: number;
  wishlistAdds: number;
  cartAdds: number;
  purchases: number;
  conversionRate: number;
  popularityScore: number;
  lastCalculated: Date;
}

export interface SearchQuery {
  id: string;
  query: string;
  userId?: string;
  sessionId?: string;
  resultCount: number;
  clickedResults?: string[];
  source?: 'autocomplete' | 'manual' | 'filter';
  filters?: SearchFilters;
  sortBy?: SortOption;
  createdAt: Date;
}

export interface ProductRecommendation {
  id: string;
  sourceProductId: string;
  recommendedProductId: string;
  type: RecommendationType;
  score: number;
  clickCount: number;
  conversionCount: number;
  reason?: string;
  createdAt: Date;
}

// Search & Filter Types
export interface SearchFilters {
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  medium?: string[];
  dimensions?: string[];
  availability?: 'in_stock' | 'all';
}

export type SortOption = 
  | 'relevance'
  | 'price_low_high'
  | 'price_high_low'
  | 'newest'
  | 'popularity'
  | 'rating';

export type RecommendationType = 
  | 'similar'
  | 'frequently_bought_together'
  | 'viewed_together'
  | 'trending'
  | 'personalized';

export interface SearchResults {
  products: Product[];
  totalResults: number;
  searchTime: number;
  filters: SearchFilters;
  sortBy: SortOption;
  suggestions?: string[];
}

export interface RecommendationResult {
  type: RecommendationType;
  products: Product[];
  reason: string;
  score: number;
}

// Enhanced Product interface with analytics
export interface ProductWithAnalytics extends Product {
  analytics?: ProductAnalytics;
  recommendations?: RecommendationResult[];
  isInWishlist?: boolean;
  viewCount?: number;
}