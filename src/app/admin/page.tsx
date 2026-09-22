import React, { Suspense } from 'react';
import { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';
import { getSiteContent, themeCssVariables } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Content Management',
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
  const identity = await getSiteContent('identity');
  const themeStyle = themeCssVariables(identity.theme);

  return (
    <div className="min-h-screen bg-gray-50" style={themeStyle as React.CSSProperties}>
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
