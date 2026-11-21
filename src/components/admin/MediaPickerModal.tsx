'use client';

import React, { DragEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchMediaLibrary,
  IMAGE_FILE_ACCEPT,
  isSupportedImageFile,
  uploadImageFile,
  type MediaLibraryItem,
} from '@/lib/image-upload-client';
import MediaThumb from '@/components/admin/MediaThumb';
import { useFileUploadInput } from '@/components/admin/useFileUploadInput';

type MediaPickerBaseProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Library items already in use by the opener; shown with a check mark. */
  selectedUrls?: string[];
  /** List uploaded videos alongside photos. */
  includeVideo?: boolean;
};

type SinglePickProps = MediaPickerBaseProps & {
  /** Pick one image; the picker closes after the choice. */
  onSelect: (url: string, alt?: string) => void;
  onToggle?: undefined;
  /** Set false when the opener already has its own upload button. */
  allowUpload?: boolean;
  /** Optional alt text input for inline rich-text image insertion. */
  showAltInput?: boolean;
  /** Shown above the media library, e.g. portfolio pieces. */
  suggested?: { heading: string; items: Array<{ url: string; label: string }> };
};

type MultiPickProps = MediaPickerBaseProps & {
  /** Add or remove items; the picker stays open until Done. */
  onToggle: (item: MediaLibraryItem) => void;
  onSelect?: undefined;
  allowUpload?: undefined;
  showAltInput?: undefined;
  suggested?: undefined;
};

type MediaPickerModalProps = SinglePickProps | MultiPickProps;

const TILE_GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4';
const TILE_SIZES = '(max-width: 640px) 33vw, 160px';

/** The one place Studio editors browse previously uploaded photos and videos. */
export default function MediaPickerModal(props: MediaPickerModalProps) {
  const { open, onClose, selectedUrls, includeVideo = false } = props;
  const multiple = typeof props.onToggle === 'function';
  const allowUpload = !multiple && props.allowUpload !== false;
  const title = props.title ?? (multiple ? 'Choose from library' : 'Choose a photo');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const [altText, setAltText] = useState('');
  const { inputRef, openFilePicker } = useFileUploadInput();
  const selected = new Set(selectedUrls ?? []);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLibraryLoading(true);
    setError(null);
    setAltText('');
    void fetchMediaLibrary({ includeVideo })
      .then((items) => {
        if (!cancelled) setLibraryItems(items);
      })
      .catch((libraryError) => {
        if (!cancelled) {
          setError(libraryError instanceof Error ? libraryError.message : 'Failed to load media library');
        }
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, includeVideo]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(item: MediaLibraryItem) {
    if (props.onToggle) {
      props.onToggle(item);
      return;
    }
    props.onSelect(item.url, altText.trim() || undefined);
    onClose();
  }

  async function upload(file: File) {
    if (!isSupportedImageFile(file)) {
      setError('Unsupported image format. Use JPG, PNG, WebP, GIF, or HEIC.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      choose(await uploadImageFile(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  if (!open) return null;

  const suggested = props.suggested && props.suggested.items.length > 0 ? props.suggested : null;
  const selectedCount = libraryItems.filter((item) => selected.has(item.url)).length;

  // Portaled to the Studio root: clear of any ancestor that could clip or trap the sheet,
  // yet still inside the Studio's own font and neutral colors.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[85vh] sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 py-1.5 pl-4 pr-1.5">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="tap-target rounded-md px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {props.showAltInput && (
            <label className="mb-4 block text-xs font-medium text-gray-700">
              Image description (optional alt text)
              <input
                type="text"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="e.g. Studio table with brushes and finished canvas"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
              />
            </label>
          )}

          {suggested && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{suggested.heading}</p>
              <div className={TILE_GRID}>
                {suggested.items.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => choose({ url: item.url, filename: item.label })}
                    className="group relative overflow-hidden rounded border border-gray-200 hover:border-gray-400"
                    title={item.label}
                  >
                    <MediaThumb src={item.url} sizes={TILE_SIZES} className="aspect-square w-full" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[11px] text-white">{item.label}</span>
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-gray-500">Media library</p>
            </div>
          )}

          {allowUpload && (
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`mb-4 flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={IMAGE_FILE_ACCEPT}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = '';
                }}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={openFilePicker}
                className="inline-flex min-h-10 items-center rounded-md border border-gray-300 px-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload new photo'}
              </button>
              <span className="text-xs text-gray-500">JPG, PNG, WebP, GIF, or HEIC · up to 25 MB</span>
            </div>
          )}

          {error && <p className="mb-3 text-sm text-red-600" role="alert">{error}</p>}

          {libraryLoading ? (
            <div className={TILE_GRID} role="status" aria-label="Loading your library">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} className="aspect-square animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : libraryItems.length === 0 ? (
            !error && (
              <p className="py-6 text-center text-sm text-gray-500">
                {allowUpload
                  ? 'Nothing here yet. Photos you upload are kept in this library.'
                  : 'Nothing here yet. Photos you upload to any page or listing are kept in this library.'}
              </p>
            )
          ) : (
            <div className={TILE_GRID}>
              {libraryItems.map((item) => {
                const isSelected = selected.has(item.url);
                return (
                  <button
                    key={item.url}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => choose(item)}
                    className={`relative overflow-hidden rounded border ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <MediaThumb
                      src={item.variants?.thumb ?? item.url}
                      kind={item.kind}
                      sizes={TILE_SIZES}
                      className="aspect-square w-full"
                    />
                    {item.kind === 'video' && (
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Video
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {multiple && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 pt-3 safe-area-bottom">
            <p className="text-sm text-gray-600" role="status">
              {selectedCount === 0 ? 'Choose photos to add' : `${selectedCount} selected`}
            </p>
            <button type="button" onClick={onClose} className="btn-primary min-h-10 px-5 text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.getElementById('studio-root') ?? document.body,
  );
}
