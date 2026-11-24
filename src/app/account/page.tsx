import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AccountDashboard from './AccountDashboard';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;

  if (from === 'signin') {
    const session = await getServerSession(authOptions);
    if (session?.user?.isAdmin) {
      redirect('/admin');
    }
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    }>
      <AccountDashboard />
    </Suspense>
  );
}
