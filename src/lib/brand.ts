import type { SiteIdentityContent } from '@/lib/site-content-shared';

type BrandIdentity = Pick<SiteIdentityContent, 'siteName' | 'headerName' | 'logoImage' | 'theme'>;

export const BRAND_ICON_SIZES = [32, 180, 192, 512] as const;
export type BrandIconSize = (typeof BRAND_ICON_SIZES)[number];

/** Up to two initials from the site name, e.g. "Michal Elena" → "ME". */
export function brandMonogram(siteName: string): string {
  const words = siteName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'A';
  const initials = words.length === 1
    ? words[0].slice(0, 1)
    : `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`;
  return initials.toUpperCase();
}

/** Changes whenever anything drawn into generated brand images changes, so URLs can be cached forever. */
export function brandAssetVersion(identity: BrandIdentity): string {
  const source = [
    identity.siteName,
    identity.theme.primaryColor,
    identity.theme.accentColor,
    identity.theme.fontPreset,
    identity.theme.pageTone,
  ].join('|');
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

/** Pass the identity when available so the URL is versioned and long-cacheable. */
export function brandIconPath(identity: BrandIdentity | null, size: BrandIconSize = 512): string {
  const base = `/api/brand/icon?size=${size}`;
  return identity ? `${base}&v=${brandAssetVersion(identity)}` : base;
}

/** The uploaded logo when there is one, otherwise the generated monogram icon. */
export function brandLogoPath(identity: BrandIdentity): string {
  return identity.logoImage || brandIconPath(identity);
}

export function parseBrandIconSize(value: string | null): BrandIconSize {
  const parsed = Number(value);
  return (BRAND_ICON_SIZES as readonly number[]).includes(parsed) ? (parsed as BrandIconSize) : 512;
}
