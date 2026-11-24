'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import {
  type ImageVariantSize,
  pickVariantUrl,
  shouldUnoptimizeImage,
} from '@/lib/image-variant-url';

export interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
  /** Optional WebP variant size for managed uploads; automatically falls back to raw URL on 404. */
  variantSize?: ImageVariantSize;
  /** Optional final fallback if both variant and raw URL fail. */
  fallbackSrc?: string;
}

/**
 * Shared resilient image primitive: serves pre-generated WebP variants directly
 * (bypassing Next/Image re-encoding) with automatic variant -> original -> fallback recovery.
 */
export function OptimizedImage({
  src,
  alt,
  variantSize,
  fallbackSrc,
  unoptimized,
  onError,
  ...props
}: OptimizedImageProps) {
  const rawSrc = src.trim();
  const preferredSrc = variantSize ? pickVariantUrl(rawSrc, variantSize) : rawSrc;
  const [activeSrc, setActiveSrc] = useState(preferredSrc);

  useEffect(() => {
    setActiveSrc(preferredSrc);
  }, [preferredSrc]);

  const bypassOptimizer =
    unoptimized ?? (activeSrc.startsWith('/uploads/') || shouldUnoptimizeImage(activeSrc));

  return (
    <Image
      {...props}
      src={activeSrc}
      alt={alt}
      unoptimized={bypassOptimizer}
      onError={(event) => {
        if (activeSrc !== rawSrc) {
          setActiveSrc(rawSrc);
        } else if (fallbackSrc && activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
        } else {
          onError?.(event);
        }
      }}
    />
  );
}

export default OptimizedImage;
