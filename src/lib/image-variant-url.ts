export type ImageVariantSize = 'thumb' | 'md' | 'lg';
export type ImageVariantMap = Partial<Record<ImageVariantSize, string>>;

const VARIANT_SUFFIX_PATTERN = /-(thumb|md|lg)\.webp$/i;

/** Split a derived WebP variant filename into the original's stem and the variant size. */
export function parseVariantFilename(filename: string): { stem: string; size: ImageVariantSize } | null {
  const trimmed = filename.trim();
  const match = VARIANT_SUFFIX_PATTERN.exec(trimmed);
  if (!match) return null;
  return { stem: trimmed.slice(0, match.index), size: match[1].toLowerCase() as ImageVariantSize };
}

/**
 * Return true when Next/Image should bypass server-side optimization:
 * - SVGs, data URIs, and blob URIs
 * - External URLs whose host is not configured in next.config remotePatterns
 *   (prevents runtime Next/Image hostname crashes when an artist pastes a custom URL).
 */
export function shouldUnoptimizeImage(src: string | null | undefined): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return true;
  if (/\.svg(\?.*)?$/i.test(trimmed)) return true;
  if (trimmed.startsWith('/')) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return !(parsed.protocol === 'https:' && host.endsWith('.blob.core.windows.net'));
  } catch {
    return true;
  }
}

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
