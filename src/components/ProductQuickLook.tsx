'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, formatPrice, productImageSrc, PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
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
  const originalSrc = useMemo(() => productPrimaryImage(product), [product]);
  const [imageSrc, setImageSrc] = useState(() => productImageSrc(product, undefined, 'md'));

  useEffect(() => {
    if (open) {
      setImageSrc(productImageSrc(product, undefined, 'md'));
    }
  }, [open, product]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick look: ${product.title}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{product.title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">Close</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-6">
          <div className="relative aspect-square bg-gray-100">
            <Image
              src={imageSrc}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
              onError={handleImageError}
              unoptimized={imageSrc.startsWith('/uploads/')}
            />
            <div className="absolute top-3 right-3">
              <WishlistButton productId={product.id} size="sm" stopNavigation />
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-gray-600">{product.medium} • {product.dimensions}</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(product.price, product.currency)}</p>
            <p className="text-sm text-gray-700 line-clamp-4">{product.description}</p>
            <AddToCartButton product={product} size="md" showVariants={Boolean(product.variants || product.customizations)} />
            <Link href={`/shop/${product.id}`} className="inline-flex text-sm font-medium text-primary hover:opacity-80">
              View full details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
