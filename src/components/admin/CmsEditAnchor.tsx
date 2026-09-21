'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { cmsEditHref, CMS_EDIT_TARGETS } from '@/lib/cms-edit-map';

type CmsEditAnchorProps = {
  targetKey: string;
  fixed?: boolean;
};

export default function CmsEditAnchor({ targetKey, fixed = false }: CmsEditAnchorProps) {
  const { data: session, status } = useSession();
  const target = CMS_EDIT_TARGETS[targetKey];

  if (status === 'loading' || !session?.user?.isAdmin || !target) {
    return null;
  }

  const wrapperClass = fixed
    ? 'pointer-events-none fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6'
    : 'pointer-events-none absolute right-3 top-3 z-30 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <div className={wrapperClass}>
      <Link
        href={cmsEditHref(targetKey)}
        className="pointer-events-auto inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white/95 px-4 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
      >
        {target.label}
      </Link>
    </div>
  );
}
