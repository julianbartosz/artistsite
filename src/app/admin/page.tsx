import React, { Suspense } from 'react';
import { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Content Management',
  description: 'Manage blog posts, portfolio items, and site content',
  robots: {
    index: false,
    follow: false,
  },
};

// Enable ISR with revalidation every 300 seconds (5 minutes)
export const revalidate = 300;

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      }>
        <AdminDashboard />
      </Suspense>
    </div>
  );
}