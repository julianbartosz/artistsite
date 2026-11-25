import type { Metadata } from "next";
import { draftMode } from 'next/headers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartProvider } from '@/components/CartContext';
import AuthProvider from '@/components/AuthProvider';
import { StructuredData, generateOrganizationSchema } from '@/components/StructuredData';
import { generateFeedLinks, socialHandle } from '@/lib/seo';
import { getSiteUrl } from '@/lib/config';
import { PerformanceMonitor, SEOMonitor } from '@/components/DynamicComponents';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import SiteShell from '@/components/SiteShell';
import AdminPwaRegister from '@/components/admin/AdminPwaRegister';
import CmsPreviewBanner from '@/components/admin/CmsPreviewBanner';
import { getPublicSiteShell } from '@/lib/public-site-shell';
import { themeCssVariables } from '@/lib/site-content';
import { isCmsPreviewActive } from '@/lib/cms-preview';
import { brandIconPath, brandLogoPath } from '@/lib/brand';
import { siteFontVariables } from './site-fonts';
import "./globals.css";

export const dynamic = 'force-dynamic';

function parseSiteUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ identity, socialUrls }, siteUrl] = await Promise.all([getPublicSiteShell(), getSiteUrl()]);
  const siteName = identity.siteName;
  const description = identity.tagline || undefined;
  const twitterHandle = socialHandle(socialUrls.twitter);
  const ogImage = '/api/og';

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    metadataBase: parseSiteUrl(siteUrl),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: '/',
      siteName,
      title: siteName,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: twitterHandle,
      creator: twitterHandle,
      title: siteName,
      description,
      images: [ogImage],
    },
    icons: {
      icon: [{ url: brandIconPath(identity, 32), sizes: '32x32', type: 'image/png' }],
      apple: [{ url: brandIconPath(identity, 180), sizes: '180x180', type: 'image/png' }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let isPreview = false;
  let cmsPreviewActive = false;
  
  try {
    const draft = await draftMode();
    isPreview = draft.isEnabled;
    cmsPreviewActive = await isCmsPreviewActive();
  } catch (error) {
    // Enhanced error handling with proper typing
    console.error('Draft mode check failed:', error);
    isPreview = false;
  }

  const [siteShell, siteUrl] = await Promise.all([getPublicSiteShell(), getSiteUrl()]);
  const feedLinks = generateFeedLinks(siteShell.identity.siteName);
  const themeStyle = themeCssVariables(siteShell.identity.theme);

  const organizationSchema = generateOrganizationSchema({
    name: siteShell.identity.siteName,
    description: siteShell.identity.tagline,
    logo: brandLogoPath(siteShell.identity),
    siteUrl,
    contactPoint: {
      email: siteShell.contactEmail,
      contactType: 'Customer Service',
    },
    sameAs: [
      siteShell.socialUrls.instagram,
      siteShell.socialUrls.twitter,
      siteShell.socialUrls.facebook,
      siteShell.socialUrls.pinterest,
    ].filter(Boolean),
  });

  return (
    <html lang="en" className={siteFontVariables} style={themeStyle as React.CSSProperties}>
      <head>
        <StructuredData data={organizationSchema} />
        {/* Feed Links - RSS and Atom */}
        {feedLinks.map((feed, index) => (
          <link
            key={index}
            rel={feed.rel}
            type={feed.type}
            title={feed.title}
            href={feed.href}
          />
        ))}
        {/* Enhanced SEO Meta Tags */}
        <meta name="theme-color" content={siteShell.identity.theme.primaryColor} />
        <meta name="color-scheme" content="light" />
        <meta name="format-detection" content="telephone=no" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!('serviceWorker'in navigator))return;var key='sw-cleanup-v4';navigator.serviceWorker.getRegistrations().then(function(regs){var hadRegs=regs.length>0;return Promise.all(regs.map(function(r){return r.unregister();})).then(function(){if('caches'in window){return caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));});}}).then(function(){if(hadRegs&&!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');location.reload();}});});}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <AnalyticsProvider>
            <CartProvider>
              <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
                <div className="contents">
                  {isPreview ? <PreviewBanner /> : null}
                  <SiteShell
                    topBanner={cmsPreviewActive && !isPreview ? <CmsPreviewBanner /> : null}
                    previewOffsetClass={isPreview ? 'pt-12' : ''}
                    adminTools={<AdminPwaRegister />}
                    header={<Header siteIdentity={siteShell.identity} />}
                    footer={(
                      <Footer
                        siteIdentity={siteShell.identity}
                        footerContent={siteShell.identity.footer}
                        contactEmail={siteShell.contactEmail}
                        socialUrls={siteShell.socialUrls}
                      />
                    )}
                  >
                    {children}
                  </SiteShell>
                </div>
                
                {/* Performance and SEO Monitoring (development only) - Temporarily disabled for build */}
                {/* <PerformanceMonitor />
                <SEOMonitor /> */}
              </ErrorBoundary>
            </CartProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
