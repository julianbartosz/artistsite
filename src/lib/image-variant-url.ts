export type ImageVariantSize = 'thumb' | 'md' | 'lg';

const VARIANT_SUFFIX_PATTERN = /-(thumb|md|lg)\.webp$/i;

/** Map an original upload URL to a generated WebP variant when available. */
export function pickVariantUrl(originalUrl: string, size: ImageVariantSize = 'thumb'): string {
  const trimmed = originalUrl?.trim();
  if (!trimmed) return originalUrl;

  if (!trimmed.startsWith('/uploads/images/')) {
    return trimmed;
  }

  if (VARIANT_SUFFIX_PATTERN.test(trimmed)) {
    return trimmed.replace(VARIANT_SUFFIX_PATTERN, `-${size}.webp`);
  }

  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return trimmed;

  return `${trimmed.slice(0, dot)}-${size}.webp`;
}
