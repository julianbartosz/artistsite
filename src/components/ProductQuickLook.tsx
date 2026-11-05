'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Product,
  formatPrice,
  productHasPurchaseOptions,
  productImageSrc,
  PRODUCT_IMAGE_FALLBACK,
} from '@/lib/commerce';
import AddToCartButton from '@/components/AddToCartButton';
import { WishlistButton } from '@/components/WishlistButton';

type ProductQuickLookProps = {
  product: Product;
  open: boolean;
  onClose: () => void;
};

function productPrimaryImage(product: Product): string {
  return product.images.thumbnail?.trim()
    || product.images.gallery.find((image) => image.trim())
    || PRODUCT_IMAGE_FALLBACK;
}

export default function ProductQuickLook({ product, open, onClose }: ProductQuickLookProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const originalSrc = useMemo(() => productPrimaryImage(product), [product]);
  const [imageSrc, setImageSrc] = useState(() => productImageSrc(product, undefined, 'md'));
  const hasOptions = productHasPurchaseOptions(product);
  const canConfigure = product.availability === 'available' && hasOptions;

  useEffect(() => {
    if (!open) return;
    setImageSrc(productImageSrc(product, undefined, 'md'));
    closeRef.current?.focus();
  }, [open, product]);

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

  function handleImageError() {
    if (imageSrc !== originalSrc) {
      setImageSrc(originalSrc);
      return;
    }
    if (imageSrc !== PRODUCT_IMAGE_FALLBACK) {
      setImageSrc(PRODUCT_IMAGE_FALLBACK);
    }
  }

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
          <div className="relative aspect-square max-h-[38vh] w-full shrink-0 bg-gray-100 sm:sticky sm:top-0 sm:max-h-none">
            <Image
              src={imageSrc}
              alt={product.title}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 100vw, 50vw"
              onError={handleImageError}
              unoptimized={imageSrc.startsWith('/uploads/') || imageSrc.endsWith('.svg')}
            />
            <div className="absolute right-3 top-3">
              <WishlistButton productId={product.id} size="sm" stopNavigation />
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto p-4 pb-8 sm:max-h-[calc(92vh-3.25rem)] sm:p-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{product.medium} • {product.dimensions}</p>
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
