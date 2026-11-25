'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import {
  ImageVariantSize,
  isVideoUrl,
  pickVariantUrl,
  shouldUnoptimizeImage,
} from '@/lib/image-variant-url';

export type ImageCarouselProps = {
  images: string[];
  alt: string;
  /** Optional navigation target when clicking the photo itself (controls sit cleanly outside <a>). */
  href?: string;
  linkTestId?: string;
  /** Optional click handler on the photo when not linking (e.g. open zoom/lightbox). */
  onImageClick?: () => void;
  imageClickAriaLabel?: string;
  /** Optional WebP variant size for /uploads/images/ assets (automatically falls back to raw -> placeholder). */
  variantSize?: ImageVariantSize;
  /** Controlled index + change callback (e.g. synced with external thumbnails). */
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Frame container classes (e.g. aspect-square bg-gray-100). */
  className?: string;
  /** Image classes (e.g. object-cover or object-contain). */
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** Keep prev/next arrows visible even when not hovering (ideal for modals and detail views). */
  alwaysShowControls?: boolean;
  /** Show a subtle "1 / 3" counter badge when multiple photos exist. */
  showCounter?: boolean;
  /** Listen for ArrowLeft/ArrowRight keyboard shortcuts while mounted (for open modals). */
  enableKeyboard?: boolean;
  /** Optional badges, wishlist buttons, or overlays rendered inside the frame. */
  children?: React.ReactNode;
};

const SWIPE_THRESHOLD_PX = 36;
const MAX_DOT_INDICATORS = 7;

export default function ImageCarousel({
  images,
  alt,
  href,
  linkTestId,
  onImageClick,
  imageClickAriaLabel,
  variantSize,
  activeIndex: controlledIndex,
  onIndexChange,
  className = 'relative aspect-square bg-gray-100 overflow-hidden',
  imageClassName = 'object-cover',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  alwaysShowControls = false,
  showCounter = false,
  enableKeyboard = false,
  children,
}: ImageCarouselProps) {
  const safeImages = images.length > 0 ? images : [PRODUCT_IMAGE_FALLBACK];
  const isControlled = typeof controlledIndex === 'number';
  const [internalIndex, setInternalIndex] = useState(0);
  const [fallbackLevels, setFallbackLevels] = useState<Record<string, number>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const count = safeImages.length;
  const hasMultiple = count > 1;
  const rawIndex = isControlled ? controlledIndex : internalIndex;
  const index = rawIndex >= 0 && rawIndex < count ? rawIndex : 0;

  // Reset uncontrolled index if the gallery identity changes (e.g. switching products).
  const firstImageKey = safeImages[0] ?? '';
  useEffect(() => {
    if (!isControlled) {
      setInternalIndex(0);
    }
  }, [firstImageKey, count, isControlled]);

  const setIndex = useCallback(
    (next: number) => {
      const wrapped = ((next % count) + count) % count;
      if (!isControlled) {
        setInternalIndex(wrapped);
      }
      onIndexChange?.(wrapped);
    },
    [count, isControlled, onIndexChange],
  );

  const goPrev = useCallback(() => setIndex(index - 1), [index, setIndex]);
  const goNext = useCallback(() => setIndex(index + 1), [index, setIndex]);

  useEffect(() => {
    if (!enableKeyboard || !hasMultiple) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboard, hasMultiple, goNext, goPrev]);

  const rawUrl = safeImages[index] ?? PRODUCT_IMAGE_FALLBACK;
  const isVideo = isVideoUrl(rawUrl);
  const preferredUrl = !isVideo && variantSize ? pickVariantUrl(rawUrl, variantSize) : rawUrl;
  const level = fallbackLevels[rawUrl] ?? 0;
  const resolvedSrc =
    level === 0
      ? preferredUrl
      : level === 1 && preferredUrl !== rawUrl
        ? rawUrl
        : PRODUCT_IMAGE_FALLBACK;

  function handleImageError() {
    setFallbackLevels((current) => {
      const next = (current[rawUrl] ?? 0) + 1;
      if (next > 2) return current;
      return { ...current, [rawUrl]: next };
    });
  }

  function handleTouchStart(event: React.TouchEvent) {
    if (!hasMultiple || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (!hasMultiple || !touchStartRef.current || event.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      suppressNextClickRef.current = true;
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 250);
    }
  }

  function handleSurfaceClick(event: React.MouseEvent) {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = false;
      return;
    }
    onImageClick?.();
  }

  const mediaWord = isVideo ? 'video' : 'photo';
  const imageAlt = hasMultiple && index > 0 ? `${alt} — ${mediaWord} ${index + 1} of ${count}` : alt;
  const unoptimized = resolvedSrc.startsWith('/uploads/') || shouldUnoptimizeImage(resolvedSrc);
  // Keep native <video controls> unobstructed on modals and detail views (thumbnail strips & arrows handle navigation).
  const interactiveVideo = isVideo && !href;

  const mediaNode = isVideo ? (
    interactiveVideo ? (
      <video
        key={rawUrl}
        src={rawUrl}
        controls
        playsInline
        preload="metadata"
        aria-label={imageAlt}
        className="h-full w-full object-contain bg-black/5"
      />
    ) : (
      // Listing cards: still frame + "Video" badge — never autoplay in the grid.
      <video
        key={rawUrl}
        src={rawUrl}
        muted
        playsInline
        preload="metadata"
        aria-label={imageAlt}
        className={`h-full w-full ${imageClassName}`}
      />
    )
  ) : (
    <Image
      src={resolvedSrc}
      alt={imageAlt}
      fill
      className={imageClassName}
      sizes={sizes}
      priority={priority && index === 0}
      unoptimized={unoptimized}
      onError={handleImageError}
    />
  );

  const arrowVisibilityClass = alwaysShowControls
    ? 'opacity-90 hover:opacity-100'
    : 'opacity-85 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/carousel:opacity-100 focus-visible:opacity-100';

  return (
    <div
      className={`group/carousel ${className}`}
      role={hasMultiple ? 'region' : undefined}
      aria-roledescription={hasMultiple ? 'carousel' : undefined}
      aria-label={hasMultiple ? `${alt} photos` : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {href ? (
        <Link
          href={href}
          aria-label={alt}
          data-testid={linkTestId}
          onClick={handleSurfaceClick}
          className="absolute inset-0 z-10 block"
        >
          {mediaNode}
        </Link>
      ) : onImageClick && !interactiveVideo ? (
        <button
          type="button"
          onClick={handleSurfaceClick}
          aria-label={imageClickAriaLabel || `Inspect ${alt}`}
          className="relative z-10 block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {mediaNode}
        </button>
      ) : (
        <div className="absolute inset-0 z-10">{mediaNode}</div>
      )}

      {isVideo && href && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 right-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-xs"
        >
          <Play size={10} className="fill-current" />
          Video
        </span>
      )}

      {children}

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label={`Previous photo of ${alt}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goPrev();
            }}
            className={`absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrowVisibilityClass}`}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={`Next photo of ${alt}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goNext();
            }}
            className={`absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrowVisibilityClass}`}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          {showCounter && (
            <span
              aria-live="polite"
              className={`pointer-events-none absolute z-20 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs ${
                interactiveVideo ? 'left-2.5 top-2.5' : 'right-2.5 bottom-2.5'
              }`}
            >
              {index + 1} / {count}
            </span>
          )}

          {!interactiveVideo && (
            count <= MAX_DOT_INDICATORS ? (
              <div
                className="absolute bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur-xs"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {safeImages.map((img, dotIndex) => {
                  const active = dotIndex === index;
                  const slideLabel = isVideoUrl(img) ? `Video ${dotIndex + 1} of ${count}` : `Photo ${dotIndex + 1} of ${count}`;
                  return (
                    <button
                      key={`${img}-${dotIndex}`}
                      type="button"
                      aria-label={slideLabel}
                      aria-current={active ? 'true' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIndex(dotIndex);
                      }}
                      className={`h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        active ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'
                      }`}
                    />
                  );
                })}
              </div>
            ) : !showCounter ? (
              <span
                aria-live="polite"
                className="pointer-events-none absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs"
              >
                {index + 1} / {count}
              </span>
            ) : null
          )}
        </>
      )}
    </div>
  );
}
