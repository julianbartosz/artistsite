'use client';
import InventoryDashboard from '@ui/components/commerce/inventory/InventoryDashboard';
import { AuthGuard } from '@ui/components/auth/AuthGuard';

export default function InventoryPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <InventoryDashboard />
      </div>
    </AuthGuard>
  );
}