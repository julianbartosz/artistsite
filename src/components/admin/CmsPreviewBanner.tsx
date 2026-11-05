'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function CmsPreviewBanner() {
  const { data: session } = useSession();
  const pathname = usePathname() || '';
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  // Studio already has its own chrome; keep preview notice on public pages only.
  if (!session?.user?.isAdmin || pathname.startsWith('/admin')) {
    return null;
  }

  const exitPreview = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const response = await fetch('/api/admin/site-content/preview', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setExiting(false);
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>
          <span className="font-medium">Preview mode</span>
          {' — '}
          You are viewing unsaved Site Pages changes.
        </span>
        <span className="inline-flex items-center gap-3">
          <Link href="/admin?tab=pages" className="font-medium underline hover:opacity-80">
            Return to editor
          </Link>
          <button
            type="button"
            onClick={() => {
              void exitPreview();
            }}
            disabled={exiting}
            className="rounded border border-amber-400 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
          >
            {exiting ? 'Exiting…' : 'Exit preview'}
          </button>
        </span>
      </div>
    </div>
  );
}
