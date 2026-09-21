'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatPrice, Product, productImageSrc } from '@/lib/commerce';
import AddToCartButton from '@/components/AddToCartButton';
import ProductRecommendations from '@/components/ProductRecommendations';
import RecentlyViewed from '@/components/RecentlyViewed';
import StockIndicator from '@/components/StockIndicator';
import { WishlistButton } from '@/components/WishlistButton';
import type { ProductDetailLayout } from '@/lib/site-content-shared';

interface ProductPageClientProps {
  product: Product;
  purchasable?: boolean;
  detailLayout?: ProductDetailLayout;
}

export default function ProductPageClient({
  product,
  purchasable = true,
  detailLayout = 'standard',
}: ProductPageClientProps) {
  const { data: session, status } = useSession();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewStartTime] = useState(Date.now());
  const [sessionId] = useState(() => {
    // Generate a simple session ID for guest users
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  useEffect(() => {
    if (status === 'loading') return;

    const trackView = async () => {
      try {
        await fetch('/api/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            sessionId: sessionId,
            source: 'direct',
          }),
        });
      } catch (error) {
        console.error('Failed to track product view:', error);
      }
    };

    trackView();

    // Track view duration when user leaves the page
    const handleBeforeUnload = () => {
      const duration = Math.floor((Date.now() - viewStartTime) / 1000);
      if (duration > 5) { // Only track if user spent more than 5 seconds
        fetch('/api/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            sessionId: sessionId,
            source: 'direct',
            duration: duration,
          }),
          keepalive: true // Ensure request completes even if page is closing
        }).catch(() => {
          // Silently fail - not critical
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [product.id, status, sessionId, viewStartTime]);

  const isAvailable = product.availability === 'available';
  const isLimitedEdition = product.edition && product.edition.remaining < product.edition.total;
  const galleryImages = product.images.gallery.length > 0 ? product.images.gallery : [product.images.thumbnail];
  const activeImage = galleryImages[selectedImageIndex] ?? galleryImages[0];
  const galleryFocus = detailLayout === 'gallery-focus';

  const purchaseActions = isAvailable ? (
    <div className="space-y-3">
      <AddToCartButton product={product} purchasable={purchasable} />
      <Link
        href={`/contact?subject=${encodeURIComponent(`Inquiry about ${product.title}`)}`}
        className="w-full min-h-11 inline-flex items-center justify-center border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
      >
        Ask About This Piece
      </Link>
    </div>
  ) : (
    <button
      type="button"
      disabled
      className="w-full min-h-11 bg-gray-300 text-gray-500 py-3 px-6 rounded-lg cursor-not-allowed font-medium"
    >
      Not Available
    </button>
  );

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <div className="max-w-7xl mx-auto page-x py-8 md:py-12">
        <nav className="mb-6 md:mb-8">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <li><Link href="/" className="hover:text-gray-700">Home</Link></li>
            <li>/</li>
            <li><Link href="/shop" className="hover:text-gray-700">Shop</Link></li>
            <li>/</li>
            <li className="text-gray-900 capitalize">{product.category.replace('-', ' ')}</li>
            <li>/</li>
            <li className="text-gray-900">{product.title}</li>
          </ol>
        </nav>

        <div className={galleryFocus ? 'space-y-10' : 'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16'}>
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={productImageSrc(product, activeImage, 'lg')}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              {!isAvailable && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold">
                    {product.availability === 'sold' ? 'SOLD' : 'RESERVED'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative aspect-square bg-gray-100 rounded overflow-hidden ring-2 transition-all ${selectedImageIndex === index ? 'ring-primary' : 'ring-transparent hover:ring-gray-300'}`}
                    aria-label={`View image ${index + 1}`}
                    aria-pressed={selectedImageIndex === index}
                  >
                    <Image
                      src={productImageSrc(product, image)}
                      alt={`${product.title} view ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 25vw, 12.5vw"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Information */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
                  <p className="text-lg text-gray-600">{product.medium} • {product.year}</p>
                  <p className="text-gray-600">{product.dimensions}</p>
                </div>
                <WishlistButton productId={product.id} />
              </div>
            </div>

            {/* Price and Availability */}
            <div className="border-t border-b border-gray-200 py-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(product.price, product.currency)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isAvailable 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {product.availability === 'available' ? 'Available' : 
                   product.availability === 'sold' ? 'Sold' : 'Reserved'}
                </span>
              </div>

              {/* Stock Status */}
              <div className="mb-4">
                <StockIndicator productId={product.id} showDetails className="mb-2" />
              </div>
              
              {isLimitedEdition && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 font-medium">Limited Edition</p>
                  <p className="text-red-600 text-sm">
                    Only {product.edition!.remaining} of {product.edition!.total} remaining
                  </p>
                </div>
              )}
              
              <div className="hidden lg:block">{purchaseActions}</div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>

            {/* Specifications */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Medium</dt>
                  <dd className="text-gray-900 font-medium">{product.medium}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Dimensions</dt>
                  <dd className="text-gray-900 font-medium">{product.dimensions}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Year</dt>
                  <dd className="text-gray-900 font-medium">{product.year}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900 font-medium capitalize">{product.category.replace('-', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Signed</dt>
                  <dd className="text-gray-900 font-medium">{product.specifications.signed ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Certificate</dt>
                  <dd className="text-gray-900 font-medium">{product.specifications.certificate ? 'Included' : 'Not included'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Framed</dt>
                  <dd className="text-gray-900 font-medium">{product.specifications.framed ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>

            {/* Shipping Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Domestic shipping:</span>
                  <span className="font-medium">{formatPrice(product.shipping.domestic)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">International shipping:</span>
                  <span className="font-medium">{formatPrice(product.shipping.international)}</span>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  All artwork is carefully packaged and fully insured during shipping.
                </p>
              </div>
            </div>

            {/* Tags */}
            {product.tags.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 md:mt-16">
          <ProductRecommendations
            productId={product.id}
            className="border-t border-gray-200 pt-10 md:pt-12"
          />
        </div>

        <div className="mt-10 md:mt-12">
          <RecentlyViewed
            currentProductId={product.id}
            maxItems={6}
            className="border-t border-gray-200 pt-10 md:pt-12"
          />
        </div>

        <div className="mt-10 md:mt-12 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Shop
          </Link>
        </div>
      </div>

      {isAvailable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden safe-area-bottom">
          <div className="page-x py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{product.title}</p>
              <p className="text-lg font-bold text-gray-900">{formatPrice(product.price, product.currency)}</p>
            </div>
            <div className="flex-shrink-0 [&_button]:min-h-11 [&_button]:px-4">
              <AddToCartButton product={product} purchasable={purchasable} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}