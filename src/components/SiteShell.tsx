'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type SiteShellProps = {
  header: React.ReactNode;
  footer: React.ReactNode;
  adminTools: React.ReactNode;
  children: React.ReactNode;
  previewOffsetClass?: string;
};

async function clearPublicServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export default function SiteShell({ header, footer, adminTools, children, previewOffsetClass = '' }: SiteShellProps) {
  const pathname = usePathname() || '';
  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdminRoute) return;
    void clearPublicServiceWorkers();
  }, [isAdminRoute]);

  if (isAdminRoute) {
    return (
      <div className={previewOffsetClass}>
        {adminTools}
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className={previewOffsetClass}>
      {header}
      <main>{children}</main>
      {footer}
    </div>
  );
}
