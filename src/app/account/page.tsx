import { Suspense } from 'react';
import AccountDashboard from './AccountDashboard';

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    }>
      <AccountDashboard />
    </Suspense>
  );
}
