import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Artist Site - Contemporary Art & Portfolio",
    template: "%s | Artist Site"
  },
  description: "Discover contemporary art, original paintings, and creative insights from a professional artist. Explore portfolio, read art blog, and shop original artworks.",
  keywords: "contemporary art, original paintings, artist portfolio, art blog, buy artwork, fine art, creative process",
  authors: [{ name: "Artist Site" }],
  creator: "Artist Site",
  publisher: "Artist Site",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Artist Site',
    title: 'Artist Site - Contemporary Art & Portfolio',
    description: 'Discover contemporary art, original paintings, and creative insights from a professional artist.',
    images: [
      {
        url: '/images/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Artist Site - Contemporary Art Portfolio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@artistsite',
    creator: '@artistsite',
    title: 'Artist Site - Contemporary Art & Portfolio',
    description: 'Discover contemporary art, original paintings, and creative insights from a professional artist.',
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

  // Generate organization schema
  const organizationSchema = generateOrganizationSchema({
    description: "Professional contemporary artist creating original paintings and digital art. Explore portfolio, commission custom artwork, and discover the creative process through our art blog.",
    logo: "/images/logo.png",
    contactPoint: {
      email: "contact@artistsite.com",
      contactType: "Customer Service"
    },
    sameAs: [
      "https://instagram.com/artistsite",
      "https://twitter.com/artistsite",
      "https://facebook.com/artistsite"
    ]
  });

  // Generate feed links for both RSS and Atom
  const feedLinks = generateFeedLinks();

  return (
    <html lang="en">
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
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        {/* Favicon and App Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
                  <Header />
                  <main>
                    {children}
                  </main>
                  <Footer />
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
