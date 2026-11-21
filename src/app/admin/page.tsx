import React, { Suspense } from 'react';
import { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';
import { DEFAULT_SITE_THEME, themeCssVariables } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Manage updates, portfolio items, and site content',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { tab } = await searchParams;
  // Studio chrome stays neutral so brand colors are judged in the preview, not in the tools.
  const themeStyle = themeCssVariables(DEFAULT_SITE_THEME);

  return (
    // The id lets Studio overlays (e.g. the media library sheet) portal here and keep this neutral theme.
    <div id="studio-root" className="min-h-screen bg-gray-50 font-sans" style={themeStyle as React.CSSProperties}>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      }>
        <AdminDashboard initialTab={tab ?? null} />
      </Suspense>
    </div>
  );
}
