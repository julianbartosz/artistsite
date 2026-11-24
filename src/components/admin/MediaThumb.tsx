'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { isVideoUrl, pickVariantUrl, shouldUnoptimizeImage } from '@/lib/image-variant-url';

type MediaThumbProps = {
  src: string;
  kind?: 'image' | 'video';
  /** Rendered width hint for the image optimizer, e.g. "40px" or "(max-width: 640px) 33vw, 160px". */
  sizes?: string;
  fit?: 'cover' | 'contain';
  /** Sizing, shape, and border for the frame (the thumb fills it). */
  className?: string;
};

/**
 * Small Studio preview of an uploaded photo or video.
 * Serves the lightweight -thumb.webp variant with automatic fallback to original -> placeholder.
 */
export default function MediaThumb({ src, kind, sizes = '160px', fit = 'cover', className = '' }: MediaThumbProps) {
  const url = src.trim();
  const resolvedKind = kind ?? (isVideoUrl(url) ? 'video' : 'image');
  const preferredUrl = resolvedKind === 'image' && url ? pickVariantUrl(url, 'thumb') : url;
  const [displaySrc, setDisplaySrc] = useState(preferredUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setDisplaySrc(preferredUrl);
    setFailedSrc(null);
  }, [preferredUrl]);

  const failed = !url || failedSrc === url;
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';

  function handleImageError() {
    if (displaySrc !== url) {
      setDisplaySrc(url);
    } else {
      setFailedSrc(url);
    }
  }

  return (
    <span className={`relative block overflow-hidden bg-gray-100 ${className}`}>
      {failed ? (
        <span className="flex h-full w-full items-center justify-center text-gray-400" role="img" aria-label="Image unavailable">
          <ImageOff size={18} aria-hidden="true" />
        </span>
      ) : resolvedKind === 'video' ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          onError={() => setFailedSrc(url)}
          className={`h-full w-full ${fitClass}`}
        />
      ) : (
        <Image
          src={displaySrc}
          alt=""
          fill
          sizes={sizes}
          unoptimized={displaySrc.startsWith('/uploads/') || shouldUnoptimizeImage(displaySrc)}
          onError={handleImageError}
          className={fitClass}
        />
      )}
    </span>
  );
}
