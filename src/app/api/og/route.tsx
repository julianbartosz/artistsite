import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { PAGE_TONES, getPublishedSiteContent } from '@/lib/site-content';
import { brandMonogram } from '@/lib/brand';
import { brandImageFonts } from '@/lib/brand-fonts';
import { getSiteUrl } from '@/lib/config';
import { absoluteUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  blog: 'Studio update',
  portfolio: 'Portfolio',
  product: 'Shop',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identity = await getPublishedSiteContent('identity');
    const { theme } = identity;
    const tone = PAGE_TONES[theme.pageTone];
    const { heading, body, fonts } = await brandImageFonts(theme.fontPreset);

    const title = searchParams.get('title')?.trim() || identity.siteName;
    const subtitle = (searchParams.get('subtitle') ?? searchParams.get('description'))?.trim()
      || (title === identity.siteName ? identity.tagline : '');
    const eyebrow = TYPE_LABELS[searchParams.get('type') ?? ''] ?? '';
    const host = new URL(absoluteUrl('/', await getSiteUrl()), request.url).host;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: tone.page,
            fontFamily: body,
            fontWeight: 600,
          }}
        >
          <div style={{ width: 24, height: '100%', background: theme.primaryColor }} />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '64px 80px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.primaryColor,
                  color: '#ffffff',
                  fontFamily: heading,
                  fontSize: 28,
                }}
              >
                {brandMonogram(identity.siteName)}
              </div>
              <div style={{ marginLeft: 20, fontSize: 28, color: '#374151' }}>{identity.siteName}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {eyebrow ? (
                <div style={{ fontSize: 24, color: theme.accentColor, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>
                  {eyebrow}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: heading,
                  fontSize: title.length > 60 ? 60 : 76,
                  lineHeight: 1.08,
                  color: theme.primaryColor,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </div>
              {subtitle ? (
                <div style={{ marginTop: 24, fontSize: 30, fontWeight: 400, lineHeight: 1.35, color: '#4b5563', maxWidth: 940 }}>
                  {subtitle.length > 150 ? `${subtitle.slice(0, 147)}…` : subtitle}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 72, height: 6, background: theme.accentColor }} />
              <div style={{ marginLeft: 20, fontSize: 24, color: theme.accentColor }}>{host}</div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
      },
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
