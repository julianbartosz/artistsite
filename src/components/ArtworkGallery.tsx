'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { collectImageGallery, PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import ImageCarousel from '@/components/ImageCarousel';
import { isVideoUrl, pickVariantUrl, shouldUnoptimizeImage } from '@/lib/image-variant-url';

interface ArtworkGalleryProps {
  title: string;
  mainImage: string;
  galleryImages?: string[];
  galleryFocus?: boolean;
  /** Optional variant resolver (e.g. productImageSrc); falls back to raw URL then placeholder on error. */
  resolveSrc?: (rawUrl: string, role: 'main' | 'thumb') => string;
  /** Optional overlay rendered inside the main image frame (e.g. SOLD / RESERVED badge). */
  overlay?: React.ReactNode;
}

export default function ArtworkGallery({
  title,
  mainImage,
  galleryImages = [],
  galleryFocus = false,
  resolveSrc,
  overlay,
}: ArtworkGalleryProps) {
  const rawImages = [mainImage, ...galleryImages]
    .map((src) => src.trim())
    .filter((src, index, list) => Boolean(src) && list.indexOf(src) === index);
  const images = rawImages.length > 0 ? collectImageGallery(rawImages) : [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [fallbackLevel, setFallbackLevel] = useState<Record<string, number>>({});

  useEffect(() => {
    if (selectedIndex >= images.length) {
      setSelectedIndex(0);
    }
  }, [images.length, selectedIndex]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      } else if (event.key === 'ArrowRight' && images.length > 1) {
        setSelectedIndex((current) => (current + 1) % images.length);
      } else if (event.key === 'ArrowLeft' && images.length > 1) {
        setSelectedIndex((current) => (current - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxOpen, images.length]);

  const rawActiveImage = images[selectedIndex] ?? images[0];
  if (!rawActiveImage) return null;

  function effectiveSrc(rawUrl: string, role: 'main' | 'thumb'): string {
    const key = `${role}:${rawUrl}`;
    const level = fallbackLevel[key] ?? 0;
    const preferred = resolveSrc
      ? resolveSrc(rawUrl, role)
      : pickVariantUrl(rawUrl, role === 'main' ? 'lg' : 'thumb');
    if (level === 0) return preferred;
    if (level === 1 && preferred !== rawUrl) return rawUrl;
    return PRODUCT_IMAGE_FALLBACK;
  }

  function advanceFallback(rawUrl: string, role: 'main' | 'thumb') {
    const key = `${role}:${rawUrl}`;
    setFallbackLevel((current) => {
      const next = (current[key] ?? 0) + 1;
      if (next > 2) return current;
      return { ...current, [key]: next };
    });
  }

  const activeIsVideo = isVideoUrl(rawActiveImage);
  const lightboxSrc = fallbackLevel[`main:${rawActiveImage}`] && fallbackLevel[`main:${rawActiveImage}`] >= 2
    ? PRODUCT_IMAGE_FALLBACK
    : rawActiveImage;

  return (
    <div className="space-y-4">
      <ImageCarousel
        images={images}
        alt={title}
        variantSize="lg"
        activeIndex={selectedIndex}
        onIndexChange={setSelectedIndex}
        onImageClick={activeIsVideo ? undefined : () => setLightboxOpen(true)}
        imageClickAriaLabel={`Inspect ${title} full size`}
        className={`group relative overflow-hidden rounded-lg bg-surface-muted/70 ring-1 ring-gray-200/70 ${
          galleryFocus ? 'aspect-[4/3] sm:aspect-[16/10] max-h-[72vh]' : 'aspect-[4/5] sm:aspect-square'
        }`}
        imageClassName="object-contain p-2 sm:p-3 transition-transform duration-300 group-hover:scale-[1.01] motion-reduce:transform-none"
        sizes={galleryFocus ? '100vw' : '(max-width: 1024px) 100vw, 50vw'}
        priority
      >
        {!activeIsVideo && (
          <span className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Zoom
          </span>
        )}
        {overlay}
      </ImageCarousel>

      {images.length > 1 && (
        <div className={`grid gap-2 ${galleryFocus ? 'grid-cols-4 md:grid-cols-6' : 'grid-cols-4'}`}>
          {images.map((image, index) => {
            const itemIsVideo = isVideoUrl(image);
            const thumbSrc = itemIsVideo ? image : effectiveSrc(image, 'thumb');
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={itemIsVideo ? `View video ${index + 1} of ${title}` : `View image ${index + 1} of ${title}`}
                aria-pressed={selectedIndex === index}
                className={`relative aspect-square overflow-hidden rounded bg-gray-100 ring-2 transition-all ${
                  selectedIndex === index ? 'ring-primary' : 'ring-transparent hover:ring-gray-300'
                }`}
              >
                {itemIsVideo ? (
                  <>
                    <video
                      src={image}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white shadow-sm">
                        <Play size={12} className="translate-x-[1px] fill-current" />
                      </span>
                    </span>
                  </>
                ) : (
                  <Image
                    src={thumbSrc}
                    alt={`${title} - View ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes={galleryFocus ? '(max-width: 768px) 25vw, 16vw' : '(max-width: 1024px) 25vw, 12.5vw'}
                    unoptimized={thumbSrc.startsWith('/uploads/') || shouldUnoptimizeImage(thumbSrc)}
                    onError={() => advanceFallback(image, 'thumb')}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} full-size view`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
          >
            Close
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIndex((current) => (current - 1 + images.length) % images.length);
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-lg text-white backdrop-blur hover:bg-white/25 sm:left-6"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIndex((current) => (current + 1) % images.length);
                }}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-lg text-white backdrop-blur hover:bg-white/25 sm:right-6"
              >
                →
              </button>
            </>
          )}

          <div
            className="relative flex max-h-[88vh] max-w-[92vw] flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            {activeIsVideo ? (
              <video
                key={rawActiveImage}
                src={rawActiveImage}
                controls
                playsInline
                autoPlay
                className="max-h-[82vh] max-w-[92vw] rounded shadow-2xl"
              />
            ) : (
              <img
                src={lightboxSrc}
                alt={selectedIndex === 0 ? title : `${title} - View ${selectedIndex + 1}`}
                className="max-h-[82vh] max-w-[92vw] rounded object-contain shadow-2xl"
              />
            )}
            {images.length > 1 && (
              <p className="mt-3 text-xs text-white/80">
                {selectedIndex + 1} / {images.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
