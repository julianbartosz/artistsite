'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { UnifiedMarketingDashboard } from '@/components/UnifiedMarketingDashboard';

export default function MarketingPage() {
  return (
    <AuthGuard adminOnly>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <UnifiedMarketingDashboard />
        </div>
      </div>
    </AuthGuard>
  );
}