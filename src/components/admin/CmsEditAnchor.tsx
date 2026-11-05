'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { cmsEditHref, CMS_EDIT_TARGETS } from '@/lib/cms-edit-map';

const CMS_EDIT_MODE_KEY = 'artistsite.cmsEditMode';
const CMS_EDIT_MODE_EVENT = 'artistsite:cms-edit-mode';

function readCmsEditMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(CMS_EDIT_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCmsEditMode(enabled: boolean) {
  try {
    window.sessionStorage.setItem(CMS_EDIT_MODE_KEY, enabled ? '1' : '0');
  } catch {
    // sessionStorage may be unavailable; in-memory listeners still update via the event.
  }
  window.dispatchEvent(new CustomEvent(CMS_EDIT_MODE_EVENT, { detail: { enabled } }));
}

function useCmsEditMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readCmsEditMode());
    const onStorage = (event: StorageEvent) => {
      if (event.key === CMS_EDIT_MODE_KEY) {
        setEnabled(event.newValue === '1');
      }
    };
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setEnabled(detail.enabled);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CMS_EDIT_MODE_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CMS_EDIT_MODE_EVENT, onCustom);
    };
  }, []);

  const setMode = useCallback((next: boolean) => {
    setEnabled(next);
    writeCmsEditMode(next);
  }, []);

  return { enabled, setMode };
}

type CmsEditAnchorProps = {
  targetKey: string;
  fixed?: boolean;
};

export default function CmsEditAnchor({ targetKey, fixed = false }: CmsEditAnchorProps) {
  const { data: session, status } = useSession();
  const { enabled, setMode } = useCmsEditMode();
  const target = CMS_EDIT_TARGETS[targetKey];
  const isAdmin = Boolean(session?.user?.isAdmin);

  if (status === 'loading' || !isAdmin || !target) {
    return null;
  }

  if (fixed) {
    return (
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
        {enabled && (
          <Link
            href={cmsEditHref(targetKey)}
            className="pointer-events-auto inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white/95 px-4 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
          >
            {target.label}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setMode(!enabled)}
          className="pointer-events-auto inline-flex min-h-11 items-center rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-gray-800"
          aria-pressed={enabled}
        >
          {enabled ? 'Done editing' : 'Edit site'}
        </button>
      </div>
    );
  }

  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-30 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
      <Link
        href={cmsEditHref(targetKey)}
        className="pointer-events-auto inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white/95 px-4 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
      >
        {target.label}
      </Link>
    </div>
  );
}
