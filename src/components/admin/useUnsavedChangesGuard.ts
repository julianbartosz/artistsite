'use client';

import { useEffect } from 'react';

const editorsWithUnsavedChanges = new Set<symbol>();

/**
 * Ask before leaving when any mounted Studio editor has unsaved work.
 * Returns true when it is safe to continue (nothing unsaved, or the artist confirmed).
 */
export function confirmLeaveWithUnsavedChanges(): boolean {
  if (editorsWithUnsavedChanges.size === 0) return true;
  return window.confirm('You have unsaved changes. Leave without saving?');
}

/**
 * Register an editor's unsaved state so both in-app navigation (Studio tabs, View site, Sign out)
 * and browser navigation (reload, close tab) warn before work is lost.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const token = Symbol('unsaved-editor');
    editorsWithUnsavedChanges.add(token);
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      editorsWithUnsavedChanges.delete(token);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}
