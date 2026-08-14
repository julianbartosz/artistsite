import { Metadata } from 'next';
import { AuthGuard } from '@/components/AuthGuard';
import AdminSettings from '@/components/AdminSettings';

export const metadata: Metadata = {
  title: 'Admin Settings - Artist Site',
  description: 'Manage site configuration and integrations',
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <AuthGuard adminOnly>
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AdminSettings />
        </div>
      </div>
    </AuthGuard>
  );
}