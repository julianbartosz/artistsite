'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { shouldUnoptimizeImage } from '@/lib/image-variant-url';

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
 * Shows a neutral placeholder when the file is missing instead of a broken image.
 */
export default function MediaThumb({ src, kind = 'image', sizes = '160px', fit = 'cover', className = '' }: MediaThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src.trim();
  const failed = !url || failedSrc === url;
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <span className={`relative block overflow-hidden bg-gray-100 ${className}`}>
      {failed ? (
        <span className="flex h-full w-full items-center justify-center text-gray-400" role="img" aria-label="Image unavailable">
          <ImageOff size={18} aria-hidden="true" />
        </span>
      ) : kind === 'video' ? (
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
          src={url}
          alt=""
          fill
          sizes={sizes}
          unoptimized={shouldUnoptimizeImage(url)}
          onError={() => setFailedSrc(url)}
          className={fitClass}
        />
      )}
    </span>
  );
}
