import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { draftMode } from 'next/headers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
  title: "Artist Site",
  description: "Creative portfolio and blog showcasing artistic work and insights",
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

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
            {children}
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
