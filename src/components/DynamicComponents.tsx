'use client';

import dynamic from 'next/dynamic';

// Dynamic imports for performance optimization
export const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  loading: () => (
    <div className="border rounded-lg p-4">
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    </div>
  ),
});

export const BlogPostEditor = dynamic(() => import('./BlogPostEditor'), {
  loading: () => (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-6">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  ),
});

export const AdminDashboard = dynamic(() => import('@/app/admin/AdminDashboard'), {
  loading: () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  ),
});

// Chart components for analytics (loaded only when needed)
export const AnalyticsChart = dynamic(() => import('./AnalyticsChart'), {
  loading: () => <div className="h-64 bg-gray-100 rounded animate-pulse" />,
});

export const PerformanceMonitor = dynamic(() => import('./PerformanceMonitor'), {
  loading: () => <div className="h-32 bg-gray-100 rounded animate-pulse" />,
});

export const SEOMonitor = dynamic(() => import('./PerformanceMonitor').then(mod => ({ default: mod.SEOMonitor })), {
  loading: () => <div className="h-24 bg-gray-100 rounded animate-pulse" />,
});