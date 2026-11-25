export type ImageVariantSize = 'thumb' | 'md' | 'lg';
export type ImageVariantMap = Partial<Record<ImageVariantSize, string>>;

const VARIANT_SUFFIX_PATTERN = /-(thumb|md|lg)\.webp$/i;
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);

function urlPathname(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).pathname.toLowerCase();
    }
  } catch {
    // Fall through to query/hash stripping for relative paths.
  }
  const withoutHash = trimmed.split('#')[0] ?? trimmed;
  return (withoutHash.split('?')[0] ?? withoutHash).toLowerCase();
}

function pathnameExtension(pathname: string): string {
  const slash = pathname.lastIndexOf('/');
  const filename = slash >= 0 ? pathname.slice(slash + 1) : pathname;
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1) : '';
}

/** True when a media URL points to a video asset (local upload, blob storage, or video file extension). */
export function isVideoUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  const pathname = urlPathname(src);
  if (!pathname) return false;
  if (pathname.includes('/uploads/videos/') || pathname.includes('/videos/')) {
    const ext = pathnameExtension(pathname);
    if (!ext || VIDEO_EXTENSIONS.has(ext)) return true;
  }
  return VIDEO_EXTENSIONS.has(pathnameExtension(pathname));
}

/** True when a media URL points to a GIF (static or animated). */
export function isGifUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  return pathnameExtension(urlPathname(src)) === 'gif';
}

/** Split a derived WebP variant filename into the original's stem and the variant size. */
export function parseVariantFilename(filename: string): { stem: string; size: ImageVariantSize } | null {
  const trimmed = filename.trim();
  const match = VARIANT_SUFFIX_PATTERN.exec(trimmed);
  if (!match) return null;
  return { stem: trimmed.slice(0, match.index), size: match[1].toLowerCase() as ImageVariantSize };
}

/** True when a URL already points to a pre-generated WebP variant (-thumb/-md/-lg.webp). */
export function isDerivedVariantUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  const pathname = urlPathname(src);
  if (!pathname) return false;
  const slash = pathname.lastIndexOf('/');
  const filename = slash >= 0 ? pathname.slice(slash + 1) : pathname;
  return parseVariantFilename(filename) !== null;
}

function configuredMediaBase(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_AZURE_STORAGE_PUBLIC_BASE_URL ||
    process.env.AZURE_STORAGE_PUBLIC_BASE_URL ||
    '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed || null;
}

function isManagedImageUploadUrl(trimmed: string): boolean {
  if (trimmed.startsWith('/uploads/images/')) {
    const rest = trimmed.slice('/uploads/images/'.length).split(/[?#]/)[0] ?? '';
    return Boolean(rest) && !rest.includes('/');
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    const isAzureBlob = parsed.protocol === 'https:' && host.endsWith('.blob.core.windows.net');
    const customBase = configuredMediaBase();
    const isConfiguredCdn = Boolean(customBase && trimmed.startsWith(`${customBase}/`));

    if (!isAzureBlob && !isConfiguredCdn) return false;

    const segments = pathname.split('/').filter(Boolean);
    // Stored under `<container>/images/<filename>` or `<prefix>/images/<filename>`.
    return segments.length >= 2 && segments[segments.length - 2]?.toLowerCase() === 'images';
  } catch {
    return false;
  }
}

/**
 * Return true when Next/Image should bypass server-side optimization:
 * - Pre-generated WebP variants (-thumb/-md/-lg.webp): already resized & compressed; skip Fly CPU re-encoding
 * - SVGs, GIFs (keeps animated GIFs moving), data URIs, and blob URIs
 * - External URLs whose host is not configured in next.config remotePatterns
 *   (prevents runtime Next/Image hostname crashes when an artist pastes a custom URL).
 */
export function shouldUnoptimizeImage(src: string | null | undefined): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return true;
  if (/\.svg(\?.*)?$/i.test(trimmed) || isGifUrl(trimmed) || isDerivedVariantUrl(trimmed)) return true;
  if (trimmed.startsWith('/')) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:' && host.endsWith('.blob.core.windows.net')) {
      return false;
    }
    const customBase = configuredMediaBase();
    if (customBase && trimmed.startsWith(`${customBase}/`)) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Map a managed uploaded image URL (local /uploads/images/ or Azure Blob .../images/) to a generated WebP variant. */
export function pickVariantUrl(originalUrl: string, size: ImageVariantSize = 'thumb'): string {
  const trimmed = originalUrl?.trim();
  if (!trimmed) return originalUrl;

  // GIFs map to first-frame WebP posters for small thumbs only; md/lg keep the animated GIF.
  // Videos and SVGs always stay raw.
  if (
    !isManagedImageUploadUrl(trimmed) ||
    isVideoUrl(trimmed) ||
    (isGifUrl(trimmed) && size !== 'thumb') ||
    /\.svg([?#].*)?$/i.test(trimmed)
  ) {
    return trimmed;
  }

  const hashIdx = trimmed.indexOf('#');
  const hashPart = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const queryIdx = withoutHash.indexOf('?');
  const queryPart = queryIdx >= 0 ? withoutHash.slice(queryIdx) : '';
  const basePath = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;

  const slashIdx = basePath.lastIndexOf('/');
  if (slashIdx < 0) return trimmed;
  const dirPart = basePath.slice(0, slashIdx + 1);
  const filename = basePath.slice(slashIdx + 1);

  if (VARIANT_SUFFIX_PATTERN.test(filename)) {
    return `${dirPart}${filename.replace(VARIANT_SUFFIX_PATTERN, `-${size}.webp`)}${queryPart}${hashPart}`;
  }

  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return trimmed;

  return `${dirPart}${filename.slice(0, dot)}-${size}.webp${queryPart}${hashPart}`;
}
