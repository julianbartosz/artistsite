'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import {
  Product,
  PRODUCT_IMAGE_FALLBACK,
  productImageSrc,
  productRawImageSrc,
} from '@/lib/commerce';
import { ImageVariantSize, isVideoUrl, shouldUnoptimizeImage } from '@/lib/image-variant-url';

type ProductImageProps = {
  product: Product;
  preferred?: string;
  variantSize?: ImageVariantSize;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
};

/**
 * Renders a product image with resilient WebP-variant -> original -> placeholder fallback.
 * Reused across shop cards, quick look, recommendations, recently viewed, cart, checkout,
 * order tracking, and inventory tables so missing derived variants never show broken icons.
 */
export default function ProductImage({
  product,
  preferred,
  variantSize = 'thumb',
  alt,
  className,
  sizes,
  priority,
  fill = false,
  width,
  height,
}: ProductImageProps) {
  const variantSrc = productImageSrc(product, preferred, variantSize);
  const rawSrc = productRawImageSrc(product, preferred);
  const [src, setSrc] = useState(variantSrc);

  useEffect(() => {
    setSrc(variantSrc);
  }, [variantSrc]);

  function handleError() {
    if (src !== rawSrc) {
      setSrc(rawSrc);
    } else if (src !== PRODUCT_IMAGE_FALLBACK) {
      setSrc(PRODUCT_IMAGE_FALLBACK);
    }
  }

  const unoptimized = src.startsWith('/uploads/') || shouldUnoptimizeImage(src);
  const resolvedAlt = alt ?? product.title;

  if (isVideoUrl(rawSrc)) {
    if (fill) {
      return (
        <>
          <video
            src={rawSrc}
            muted
            playsInline
            preload="metadata"
            aria-label={resolvedAlt}
            className={`absolute inset-0 h-full w-full ${className ?? 'object-cover'}`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white shadow-sm">
              <Play size={10} className="translate-x-[1px] fill-current" />
            </span>
          </span>
        </>
      );
    }
    return (
      <video
        src={rawSrc}
        muted
        playsInline
        preload="metadata"
        aria-label={resolvedAlt}
        width={width ?? 64}
        height={height ?? 64}
        className={className}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={resolvedAlt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={resolvedAlt}
      width={width ?? 64}
      height={height ?? 64}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      onError={handleError}
    />
  );
}
