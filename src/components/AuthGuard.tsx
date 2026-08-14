'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  adminOnly?: boolean;
}

export function AuthGuard({ 
  children, 
  fallback,
  redirectTo = '/auth/signin',
  adminOnly = false,
}: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      router.push(redirectTo);
      return;
    }

    if (adminOnly && !session.user.isAdmin) {
      router.push('/');
    }
  }, [adminOnly, session, status, router, redirectTo]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    return fallback || null;
  }

  if (adminOnly && !session.user.isAdmin) {
    return fallback || null;
  }

  return <>{children}</>;
}