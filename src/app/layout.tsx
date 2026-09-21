import type { Metadata } from "next";
import { draftMode } from 'next/headers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartProvider } from '@/components/CartContext';
import AuthProvider from '@/components/AuthProvider';
import { StructuredData, generateOrganizationSchema } from '@/components/StructuredData';
import { generateFeedLinks } from '@/lib/seo';
import { PerformanceMonitor, SEOMonitor } from '@/components/DynamicComponents';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import SiteShell from '@/components/SiteShell';
import AdminPwaRegister from '@/components/admin/AdminPwaRegister';
import CmsPreviewBanner from '@/components/admin/CmsPreviewBanner';
import { getPublicSiteShell } from '@/lib/public-site-shell';
import { getSiteContent, themeCssVariables } from '@/lib/site-content';
import { isCmsPreviewActive } from '@/lib/cms-preview';
import "./globals.css";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getSiteContent('identity');
  const siteName = identity.siteName;
  const description =
    identity.tagline ||
    'Discover contemporary art, original paintings, and creative insights from a professional artist. Explore portfolio, read art blog, and shop original artworks.';

  return {
    title: {
      default: `${siteName} - Contemporary Art & Portfolio`,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: 'contemporary art, original paintings, artist portfolio, art blog, buy artwork, fine art, creative process',
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com'),
    alternates: {
      canonical: '/',
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: '/',
      siteName,
      title: `${siteName} - Contemporary Art & Portfolio`,
      description,
      images: [
        {
          url: '/images/og-default.jpg',
          width: 1200,
          height: 630,
          alt: `${siteName} - Contemporary Art Portfolio`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@artistsite',
      creator: '@artistsite',
      title: `${siteName} - Contemporary Art & Portfolio`,
      description,
      images: ['/images/og-default.jpg'],
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

  // Generate feed links for both RSS and Atom
  const feedLinks = generateFeedLinks();
  const siteShell = await getPublicSiteShell();
  const themeStyle = themeCssVariables(siteShell.identity.theme);

  const organizationSchema = generateOrganizationSchema({
    name: siteShell.identity.siteName,
    description: siteShell.identity.tagline,
    logo: '/images/logo.png',
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
    <html lang="en" style={themeStyle as React.CSSProperties}>
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
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        {/* Favicon and App Icon */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
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
                <>
                  {isPreview && <PreviewBanner />}
                  {cmsPreviewActive && !isPreview && <CmsPreviewBanner />}
                  <SiteShell
                    previewOffsetClass={(isPreview || cmsPreviewActive) ? 'pt-12' : ''}
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
                </>
                
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
