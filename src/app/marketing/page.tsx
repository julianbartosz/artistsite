'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { UnifiedMarketingDashboard } from '@/components/UnifiedMarketingDashboard';

export default function MarketingPage() {
  return (
    <AuthGuard adminOnly>
      <div className="min-h-screen bg-gray-50">
        <UnifiedMarketingDashboard />
      </div>
    </AuthGuard>
  );
}