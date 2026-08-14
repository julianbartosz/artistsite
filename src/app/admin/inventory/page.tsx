'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import InventoryDashboard from '@/components/InventoryDashboard';
import { AuthGuard } from '@/components/AuthGuard';

export default function InventoryPage() {
  return (
    <AuthGuard adminOnly>
      <div className="min-h-screen bg-gray-50">
        <InventoryDashboard />
      </div>
    </AuthGuard>
  );
}