'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export default function AdminPwaRegister() {
  const { data: session } = useSession();
  const lastOrderCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if ('caches' in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.isAdmin || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let cancelled = false;

    if (process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    async function pollOrders() {
      try {
        const response = await fetch('/api/admin/stats', { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const orderCount = Number(data.totalOrders ?? 0);
        if (lastOrderCountRef.current !== null && orderCount > lastOrderCountRef.current) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New order received', {
              body: 'Open Orders in your studio dashboard to review it.',
              tag: 'artist-site-order',
            });
          }
        }
        lastOrderCountRef.current = orderCount;
      } catch {
        // Ignore polling failures.
      }
    }

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    void pollOrders();
    const interval = window.setInterval(pollOrders, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.user?.isAdmin]);

  return null;
}
