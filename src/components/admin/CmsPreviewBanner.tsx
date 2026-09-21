'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function CmsPreviewBanner() {
  const { data: session } = useSession();

  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
      <span className="font-medium">Preview mode</span>
      {' — '}
      You are viewing unsaved Site Pages changes.
      {' '}
      <Link href="/admin?tab=pages" className="font-medium underline hover:opacity-80">
        Return to editor
      </Link>
    </div>
  );
}
