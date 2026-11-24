'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { describeProductShipping, formatEditionStatus, formatPrice, Product, productGalleryImages, productImageSrc } from '@/lib/commerce';
import AddToCartButton from '@/components/AddToCartButton';
import ArtworkGallery from '@/components/ArtworkGallery';
import ProductRecommendations from '@/components/ProductRecommendations';
import RecentlyViewed from '@/components/RecentlyViewed';
import StockIndicator from '@/components/StockIndicator';
import { WishlistButton } from '@/components/WishlistButton';
import { useEcommerceTracking } from '@/components/AnalyticsProvider';
import { splitPlainParagraphs, type ProductDetailLayout } from '@/lib/site-content-shared';

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
  const { trackProductView } = useEcommerceTracking();
  const [viewStartTime] = useState(Date.now());
  const [sessionId] = useState(() => {
    // Generate a simple session ID for guest users
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  useEffect(() => {
    if (status === 'loading') return;

    trackProductView(product.id, product.title, product.category, product.price);

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
  }, [product.id, product.title, product.category, product.price, status, sessionId, viewStartTime, trackProductView]);

  const isAvailable = product.availability === 'available';
  const editionStatus = formatEditionStatus(product.edition);
  const galleryImages = productGalleryImages(product);
  const primaryImage = galleryImages[0] || '';
  const galleryFocus = detailLayout === 'gallery-focus';
  const categoryLabel = product.category.replaceAll('-', ' ');
  const availabilityBadge = product.availability === 'sold'
    ? { overlay: 'SOLD', label: 'Sold', overlayTone: 'bg-red-600', pillTone: 'bg-red-100 text-red-800' }
    : product.availability === 'commissioned'
      ? { overlay: 'COMMISSION', label: 'Commission only', overlayTone: 'bg-blue-700', pillTone: 'bg-blue-100 text-blue-800' }
      : { overlay: 'RESERVED', label: 'Reserved', overlayTone: 'bg-amber-600', pillTone: 'bg-amber-100 text-amber-800' };

  // Always mount AddToCartButton so sold/reserved commission CTAs match Quick Look behavior.
  const purchaseActions = (
    <div className="space-y-3">
      <AddToCartButton product={product} purchasable={purchasable} />
      <Link
        href={`/contact?subject=${encodeURIComponent(`Inquiry about ${product.title}`)}&inquiryType=purchase`}
        className="w-full min-h-11 inline-flex items-center justify-center border border-gray-300 text-gray-700 py-3 px-6 rounded-button hover:bg-gray-50 transition-colors font-medium"
      >
        Ask about this piece
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto page-x py-8 md:py-12">
        <nav className="mb-6 md:mb-8">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <li><Link href="/" className="hover:text-gray-700">Home</Link></li>
            <li>/</li>
            <li><Link href="/shop" className="hover:text-gray-700">Shop</Link></li>
            <li>/</li>
            <li>
              <Link
                href={`/shop?category=${encodeURIComponent(product.category)}`}
                className="capitalize hover:text-gray-700"
              >
                {categoryLabel}
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900">{product.title}</li>
          </ol>
        </nav>

        <div className={galleryFocus ? 'space-y-10' : 'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16'}>
          <ArtworkGallery
            title={product.title}
            mainImage={primaryImage}
            galleryImages={galleryImages}
            galleryFocus={galleryFocus}
            resolveSrc={(rawUrl, role) => productImageSrc(product, rawUrl, role === 'main' ? 'lg' : 'thumb')}
            overlay={!isAvailable ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
                <span className={`rounded-lg px-4 py-2 font-semibold text-white ${availabilityBadge.overlayTone}`}>
                  {availabilityBadge.overlay}
                </span>
              </div>
            ) : undefined}
          />

          {/* Product Information */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
                  {[product.medium, product.year].filter(Boolean).length > 0 && (
                    <p className="text-lg text-gray-600">{[product.medium, product.year].filter(Boolean).join(' • ')}</p>
                  )}
                  {product.dimensions.trim() && (
                    <p className="text-gray-600">{product.dimensions}</p>
                  )}
                </div>
                <WishlistButton productId={product.id} />
              </div>
            </div>

            {/* Price and Availability */}
            <div className="border-t border-b border-gray-200 py-6">
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(product.price, product.currency)}
                </span>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3">
                {isAvailable ? (
                  <StockIndicator
                    productId={product.id}
                    showDetails
                    missingInventoryLabel="Available"
                  />
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${availabilityBadge.pillTone}`}>
                    {availabilityBadge.label}
                  </span>
                )}
              </div>
              
              {editionStatus && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 font-medium">Limited Edition</p>
                  <p className="text-red-600 text-sm">
                    {editionStatus}
                  </p>
                </div>
              )}
              
              {purchaseActions}
            </div>

            {/* Description */}
            {splitPlainParagraphs(product.description).length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed">
                  {splitPlainParagraphs(product.description).map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {product.medium.trim() && (
                  <div>
                    <dt className="text-gray-500">Medium</dt>
                    <dd className="text-gray-900 font-medium">{product.medium}</dd>
                  </div>
                )}
                {product.dimensions.trim() && (
                  <div>
                    <dt className="text-gray-500">Dimensions</dt>
                    <dd className="text-gray-900 font-medium">{product.dimensions}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Year</dt>
                  <dd className="text-gray-900 font-medium">{product.year}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900 font-medium capitalize">{categoryLabel}</dd>
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
            {(() => {
              const shippingInfo = describeProductShipping(product);
              return (
                <div className="bg-surface-muted rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping</h2>
                  <div className="space-y-2 text-sm">
                    {shippingInfo.isPickupOnly ? (
                      <p className="font-medium text-gray-800">{shippingInfo.summary}</p>
                    ) : (
                      <>
                        {shippingInfo.domesticLabel && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">US shipping:</span>
                            <span className="font-medium">{shippingInfo.domesticLabel}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">International shipping:</span>
                          <span className="font-medium">{shippingInfo.internationalLabel ?? 'Not available'}</span>
                        </div>
                      </>
                    )}
                    <p className="text-gray-500 text-xs mt-3">
                      {shippingInfo.isPickupOnly
                        ? 'Pickup or local delivery details are arranged directly with the studio after purchase.'
                        : 'Carefully packaged in the studio before shipping.'}
                    </p>
                  </div>
                </div>
              );
            })()}

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
    </div>
  );
}
