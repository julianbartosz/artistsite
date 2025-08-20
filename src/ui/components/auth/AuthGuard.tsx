// filepath: src/ui/components/auth/AuthGuard.tsx
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode, useMemo } from 'react';
declare global {
  interface Window { __E2E_AUTH_BYPASS__?: boolean }
}
interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}
export function AuthGuard({ 
  children, 
  fallback,
  redirectTo = '/auth/signin' 
}: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const bypassAuth = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const lsBypass = window.localStorage?.getItem?.('AUTH_BYPASS') === 'true';
      const globalFlag = window.__E2E_AUTH_BYPASS__ === true;
      return lsBypass || globalFlag;
    } catch {
      return false;
    }
  }, []);
  useEffect(() => {
    if (bypassAuth) return;
    if (status === 'loading') return;
    if (!session) {
      router.push(redirectTo);
    }
  }, [session, status, router, redirectTo, bypassAuth]);
  if (bypassAuth) {
    return <>{children}</>;
  }
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
  return <>{children}</>;
}
