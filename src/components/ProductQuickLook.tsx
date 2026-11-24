'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Product,
  formatPrice,
  productGalleryImages,
  productHasPurchaseOptions,
} from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';
import ImageCarousel from '@/components/ImageCarousel';
import ProductImage from '@/components/ProductImage';
import AddToCartButton from '@/components/AddToCartButton';
import { WishlistButton } from '@/components/WishlistButton';

type ProductQuickLookProps = {
  product: Product;
  open: boolean;
  onClose: () => void;
};

export default function ProductQuickLook({ product, open, onClose }: ProductQuickLookProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const galleryImages = useMemo(() => productGalleryImages(product), [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasOptions = productHasPurchaseOptions(product);
  const canConfigure = product.availability === 'available' && hasOptions;

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    closeRef.current?.focus();
  }, [open, product.id]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick look: ${product.title}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{product.title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start overflow-y-auto sm:grid-cols-2 sm:overflow-hidden">
          <div className="w-full shrink-0 bg-gray-100 sm:sticky sm:top-0">
            <ImageCarousel
              images={galleryImages}
              alt={product.title}
              variantSize="md"
              activeIndex={activeIndex}
              onIndexChange={setActiveIndex}
              showCounter
              enableKeyboard
              className="relative aspect-square max-h-[38vh] w-full bg-gray-100 overflow-hidden sm:max-h-none"
              imageClassName="object-contain"
              sizes="(max-width: 640px) 100vw, 50vw"
            >
              <div className="absolute right-3 top-3 z-20">
                <WishlistButton productId={product.id} size="sm" stopNavigation />
              </div>
            </ImageCarousel>

            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-gray-200/80 bg-white px-3 py-2.5">
                {galleryImages.map((imageUrl, thumbIndex) => {
                  const selected = thumbIndex === activeIndex;
                  const itemIsVideo = isVideoUrl(imageUrl);
                  return (
                    <button
                      key={`${imageUrl}-${thumbIndex}`}
                      type="button"
                      onClick={() => setActiveIndex(thumbIndex)}
                      aria-label={itemIsVideo ? `View video ${thumbIndex + 1} of ${product.title}` : `View photo ${thumbIndex + 1} of ${product.title}`}
                      aria-pressed={selected}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded bg-gray-100 ring-2 transition-all ${
                        selected ? 'ring-primary' : 'ring-transparent hover:ring-gray-300'
                      }`}
                    >
                      <ProductImage
                        product={product}
                        preferred={imageUrl}
                        variantSize="thumb"
                        alt={`${product.title} — ${itemIsVideo ? 'video' : 'photo'} ${thumbIndex + 1}`}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 overflow-y-auto p-4 pb-8 sm:max-h-[calc(92vh-3.25rem)] sm:p-6">
            <div className="space-y-2">
              {[product.medium, product.dimensions].filter(Boolean).length > 0 && (
                <p className="text-sm text-gray-600">{[product.medium, product.dimensions].filter(Boolean).join(' • ')}</p>
              )}
              {!canConfigure && (
                <p className="text-2xl font-bold text-gray-900">{formatPrice(product.price, product.currency)}</p>
              )}
              <p className="text-sm text-gray-700 line-clamp-4">{product.description}</p>
            </div>

            <AddToCartButton
              product={product}
              size="md"
              details="compact"
              showVariants={canConfigure}
            />

            <Link
              href={`/shop/${product.id}`}
              className="inline-flex text-sm font-medium text-primary hover:opacity-80"
              onClick={onClose}
            >
              View full details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
