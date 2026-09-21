'use client';

import { useRef } from 'react';

/** Reliable file-picker trigger (label+sr-only fails in some embedded browsers). */
export function useFileUploadInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  function openFilePicker() {
    inputRef.current?.click();
  }

  return { inputRef, openFilePicker };
}
