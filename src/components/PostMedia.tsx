'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PostMediaItem } from '@/lib/admin-content';
import { pickVariantUrl } from '@/lib/image-variant-url';

type PostMediaProps = {
  items: PostMediaItem[];
  title: string;
  layout?: 'feed' | 'grid' | 'detail';
  /** Optional click handler for opening quick look without nesting interactive controls inside a button. */
  onOpen?: () => void;
  openAriaLabel?: string;
  enableKeyboard?: boolean;
  priority?: boolean;
};

const SWIPE_THRESHOLD_PX = 36;
const MAX_DOT_INDICATORS = 7;

export default function PostMedia({
  items,
  title,
  layout = 'feed',
  onOpen,
  openAriaLabel,
  enableKeyboard = false,
  priority = false,
}: PostMediaProps) {
  const [index, setIndex] = useState(0);
  const [rawFallback, setRawFallback] = useState<Record<string, boolean>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const count = items.length;
  const hasMultiple = count > 1;
  const safeIndex = index >= 0 && index < count ? index : 0;

  useEffect(() => {
    setIndex(0);
  }, [count, items[0]?.url]);

  const setSlide = useCallback(
    (next: number) => {
      if (count <= 1) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!enableKeyboard || !hasMultiple) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSlide(safeIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSlide(safeIndex - 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboard, hasMultiple, safeIndex, setSlide]);

  if (count === 0) return null;

  const item = items[safeIndex] ?? items[0];

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
      suppressClickRef.current = true;
      setSlide(dx < 0 ? safeIndex + 1 : safeIndex - 1);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);
    }
  }

  function handleOpen() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen?.();
  }

  const isGrid = layout === 'grid';
  const isDetail = layout === 'detail';
  const frameClass = isGrid
    ? 'group/carousel relative aspect-square overflow-hidden bg-gray-100'
    : isDetail
      ? 'group/carousel relative overflow-hidden rounded-lg bg-gray-100'
      : 'group/carousel relative overflow-hidden rounded-xl bg-gray-100';

  const mediaClass = isGrid
    ? 'h-full w-full object-cover'
    : hasMultiple
      ? 'aspect-[4/3] sm:aspect-[16/10] max-h-[70vh] w-full bg-gray-50 object-contain'
      : 'mx-auto max-h-[75vh] w-full bg-gray-50 object-contain';

  const videoClass = isGrid
    ? 'h-full w-full object-cover'
    : hasMultiple
      ? 'aspect-[4/3] sm:aspect-[16/10] max-h-[70vh] w-full bg-black object-contain'
      : 'max-h-[75vh] w-full bg-black object-contain';

  const arrowVisibilityClass =
    'opacity-85 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/carousel:opacity-100 focus-visible:opacity-100';

  const preferredImageUrl = item.type === 'video'
    ? item.url
    : pickVariantUrl(item.url, isDetail ? 'lg' : 'md');
  const resolvedImageUrl = rawFallback[item.url] ? item.url : preferredImageUrl;

  const mediaElement = item.type === 'video' ? (
    <video
      key={item.url}
      src={item.url}
      poster={item.poster}
      className={videoClass}
      controls={!isGrid}
      muted={isGrid}
      playsInline
      preload="metadata"
    />
  ) : (
    <img
      key={item.url}
      src={resolvedImageUrl}
      alt={item.alt || (hasMultiple ? `${title}, media ${safeIndex + 1} of ${count}` : title)}
      className={mediaClass}
      loading={priority && safeIndex === 0 ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (resolvedImageUrl !== item.url) {
          setRawFallback((current) => ({ ...current, [item.url]: true }));
        }
      }}
    />
  );

  return (
    <div
      className={frameClass}
      role={hasMultiple ? 'region' : undefined}
      aria-roledescription={hasMultiple ? 'carousel' : undefined}
      aria-label={hasMultiple ? `${title} media` : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          aria-label={openAriaLabel || `Open ${title}`}
          className={`block w-full text-left ${isGrid ? 'h-full' : ''}`}
        >
          {mediaElement}
        </button>
      ) : (
        mediaElement
      )}

      {isGrid && item.type === 'video' && (
        <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Video
        </span>
      )}

      {hasMultiple && (
        <>
          <span
            aria-live="polite"
            className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs"
          >
            {safeIndex + 1} / {count}
          </span>

          <button
            type="button"
            aria-label={`Previous media of ${title}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSlide(safeIndex - 1);
            }}
            className={`absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrowVisibilityClass}`}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={`Next media of ${title}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSlide(safeIndex + 1);
            }}
            className={`absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${arrowVisibilityClass}`}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          {count <= MAX_DOT_INDICATORS && (
            <div
              className={`absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur-xs ${
                isGrid ? 'bottom-10 md:bottom-2.5' : 'bottom-3'
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {items.map((mediaItem, dotIndex) => {
                const active = dotIndex === safeIndex;
                return (
                  <button
                    key={`${mediaItem.url}-${dotIndex}`}
                    type="button"
                    aria-label={`Slide ${dotIndex + 1} of ${count}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSlide(dotIndex);
                    }}
                    className={`h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      active ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
