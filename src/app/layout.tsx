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
import { getPublicSiteShell } from '@/lib/public-site-shell';
import { getSiteContent, themeCssVariables } from '@/lib/site-content';
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
  
  try {
    const draft = await draftMode();
    isPreview = draft.isEnabled;
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
      </head>
      <body className="antialiased">
        <AuthProvider>
          <AnalyticsProvider>
            <CartProvider>
              <ErrorBoundary 
                showDetails={process.env.NODE_ENV === 'development'}
                fallback={
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-2xl font-bold text-gray-800 mb-4">
                        Something went wrong
                      </h1>
                      <p className="text-gray-600">
                        Please refresh the page or try again later.
                      </p>
                    </div>
                  </div>
                }
              >
                {isPreview && <PreviewBanner />}
                <div className={isPreview ? "pt-12" : ""}>
                  <Header siteIdentity={siteShell.identity} />
                  <main>
                    {children}
                  </main>
                  <Footer
                    siteIdentity={siteShell.identity}
                    footerContent={siteShell.identity.footer}
                    contactEmail={siteShell.contactEmail}
                    socialUrls={siteShell.socialUrls}
                  />
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
