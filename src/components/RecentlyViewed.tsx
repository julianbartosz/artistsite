'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { Product, productImageSrc } from '@/lib/commerce';

interface RecentlyViewedProps {
  currentProductId?: string;
  maxItems?: number;
  className?: string;
}

interface ViewedProduct {
  productId: string;
  viewedAt: number;
}

export function RecentlyViewed({ 
  currentProductId, 
  maxItems = 6, 
  className = "" 
}: RecentlyViewedProps) {
  const { data: session } = useSession();
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentlyViewed = async () => {
      try {
        setIsLoading(true);
        
        if (session?.user?.id) {
          // For authenticated users, fetch from database
          const response = await fetch(`/api/recently-viewed?userId=${session.user.id}&limit=${maxItems}`);
          const data = await response.json();
          
          if (data.success) {
            setRecentlyViewed(data.products);
          }
        } else {
          // For guests, use localStorage
          const stored = localStorage.getItem('recently_viewed');
          if (stored) {
            const viewedIds: ViewedProduct[] = JSON.parse(stored);
            const response = await fetch('/api/search?limit=1000');
            const data = await response.json();
            const productMap = new Map<string, Product>(
              (data.success ? data.products || [] : []).map((product: Product) => [product.id, product])
            );
            const products = viewedIds
              .filter(item => item.productId !== currentProductId)
              .slice(0, maxItems)
              .map(item => productMap.get(item.productId))
              .filter(Boolean) as Product[];
            
            setRecentlyViewed(products);
          }
        }
      } catch (error) {
        console.error('Failed to load recently viewed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentlyViewed();
  }, [session?.user?.id, currentProductId, maxItems]);

  // Add current product to recently viewed
  useEffect(() => {
    if (!currentProductId) return;

    const addToRecentlyViewed = async () => {
      if (session?.user?.id) {
        // For authenticated users, let the server handle it via the existing view tracking
        return;
      } else {
        // For guests, update localStorage
        const stored = localStorage.getItem('recently_viewed');
        const viewedIds: ViewedProduct[] = stored ? JSON.parse(stored) : [];
        
        // Remove if already exists and add to front
        const filtered = viewedIds.filter(item => item.productId !== currentProductId);
        const updated = [{ productId: currentProductId, viewedAt: Date.now() }, ...filtered];
        
        // Keep only last 20 items
        const trimmed = updated.slice(0, 20);
        localStorage.setItem('recently_viewed', JSON.stringify(trimmed));
      }
    };

    addToRecentlyViewed();
  }, [currentProductId, session?.user?.id]);

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (recentlyViewed.length === 0) {
    return null;
  }

  return (
    <section className={`${className}`}>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Recently Viewed</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {recentlyViewed.map((product) => (
          <Link key={product.id} href={`/shop/${product.id}`} className="group">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
              <div className="aspect-square relative overflow-hidden">
                <Image
                  src={productImageSrc(product)}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                  {product.title}
                </h3>
                <p className="text-xs text-gray-500 mb-1">{product.medium}</p>
                <p className="text-sm font-semibold text-gray-900">
                  ${product.price.toLocaleString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default RecentlyViewed;