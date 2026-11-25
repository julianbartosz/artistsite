import 'server-only';
import { ImageResponse } from 'next/og';
import { contrastRatio, getPublishedSiteContent } from '@/lib/site-content';
import { brandAssetVersion, brandMonogram, type BrandIconSize } from '@/lib/brand';
import { brandImageFonts } from '@/lib/brand-fonts';

/** Shared ImageResponse for brand monogram icons (crawlable and /api aliases). */
export async function createBrandIconResponse(
  size: BrandIconSize,
  versionParam: string | null = null,
): Promise<ImageResponse> {
  const identity = await getPublishedSiteContent('identity');
  const { theme } = identity;
  const { heading, fonts } = await brandImageFonts(theme.fontPreset);
  const monogram = brandMonogram(identity.siteName);
  const isCurrent = versionParam === brandAssetVersion(identity);
  const ruleColor = contrastRatio(theme.accentColor, theme.primaryColor) >= 1.6
    ? theme.accentColor
    : 'rgba(255, 255, 255, 0.55)';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.primaryColor,
          color: '#ffffff',
          fontFamily: heading,
          fontWeight: 600,
        }}
      >
        <div style={{ fontSize: size * (monogram.length > 1 ? 0.4 : 0.5), lineHeight: 1, letterSpacing: '-0.02em' }}>
          {monogram}
        </div>
        {size >= 180 ? (
          <div style={{ marginTop: size * 0.05, width: size * 0.22, height: Math.max(2, size * 0.025), background: ruleColor, borderRadius: 999 }} />
        ) : null}
      </div>
    ),
    {
      width: size,
      height: size,
      fonts,
      headers: {
        'Cache-Control': isCurrent
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=300',
      },
    },
  );
}
