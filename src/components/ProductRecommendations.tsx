'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/commerce';
import { RecommendationResult } from '@/lib/types';
import { useSession } from 'next-auth/react';

interface ProductRecommendationsProps {
  productId?: string;
  userId?: string;
  className?: string;
  maxSections?: number;
}

interface RecommendationSectionProps {
  title: string;
  products: Product[];
  reason?: string;
  className?: string;
}

export function ProductRecommendations({ 
  productId, 
  userId, 
  className = "",
  maxSections = 2 
}: ProductRecommendationsProps) {
  const { data: session } = useSession();
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!productId && !userId && !session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        
        if (productId) {
          params.set('productId', productId);
          params.set('types', 'similar,frequently_bought_together');
        } else if (userId || session?.user?.id) {
          params.set('userId', userId || session!.user!.id);
        }
        
        params.set('limit', '4');

        const response = await fetch(`/api/recommendations?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          // Filter out empty recommendations and limit sections
          const validRecommendations = data.recommendations
            .filter((rec: RecommendationResult) => rec.products.length > 0)
            .slice(0, maxSections);
          setRecommendations(validRecommendations);
        } else {
          setError('Failed to load recommendations');
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [productId, userId, session?.user?.id, maxSections]);

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse space-y-8">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-3">
                <div className="h-48 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Don't show anything if there's an error or no recommendations
  }

  return (
    <div className={`space-y-12 ${className}`}>
      {recommendations.map((recommendation, index) => (
        <RecommendationSection
          key={`${recommendation.type}-${index}`}
          title={getRecommendationTitle(recommendation.type)}
          products={recommendation.products}
          reason={recommendation.reason}
        />
      ))}
    </div>
  );
}

function RecommendationSection({ title, products, reason, className = "" }: RecommendationSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className={`${className}`}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        {reason && (
          <p className="text-gray-600 text-sm">{reason}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/shop/${product.id}`} className="group">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={product.images.thumbnail}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>
        
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
            {product.title}
          </h4>
          <p className="text-xs text-gray-500 mb-2">{product.medium}</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-gray-900">
              ${product.price.toLocaleString()}
            </p>
            {product.category && (
              <span className="text-xs text-gray-500 capitalize">
                {product.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function getRecommendationTitle(type: string): string {
  switch (type) {
    case 'similar':
      return 'Similar Artworks';
    case 'frequently_bought_together':
      return 'Frequently Bought Together';
    case 'viewed_together':
      return 'People Also Viewed';
    case 'personalized':
      return 'Recommended for You';
    case 'trending':
      return 'Trending Now';
    default:
      return 'You Might Also Like';
  }
}

export default ProductRecommendations;