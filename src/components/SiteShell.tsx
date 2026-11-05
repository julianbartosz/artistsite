'use client';

import { Children, useEffect } from 'react';
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

  // Next may pass opaque/array children from the app router; toArray assigns stable keys.
  const page = Children.toArray(children);
  // Preview banners are public-only; do not reserve top padding inside Studio.
  const shellOffsetClass = isAdminRoute ? '' : previewOffsetClass;

  if (isAdminRoute) {
    return (
      <div className={shellOffsetClass}>
        <div key="admin-tools" className="contents">
          {adminTools}
        </div>
        <main key="admin-main">{page}</main>
      </div>
    );
  }

  return (
    <div className={shellOffsetClass}>
      <div key="site-header" className="contents">
        {header}
      </div>
      <main key="site-main">{page}</main>
      <div key="site-footer" className="contents">
        {footer}
      </div>
    </div>
  );
}
