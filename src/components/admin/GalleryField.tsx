'use client';

import React, { ChangeEvent, DragEvent, useState } from 'react';
import { fetchMediaLibrary, uploadImageFile, uploadMediaFile, type MediaLibraryItem } from '@/lib/image-upload-client';
import type { PostMediaItem } from '@/lib/admin-content';
import { useFileUploadInput } from '@/components/admin/useFileUploadInput';

function reorder<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function asMediaItems(value: string[] | PostMediaItem[]): PostMediaItem[] {
  return value.map((entry) => (
    typeof entry === 'string' ? { url: entry, type: 'image' as const } : entry
  ));
}

type GalleryFieldBase = {
  label: string;
  help?: string;
};

type ImageGalleryProps = GalleryFieldBase & {
  accept?: 'image';
  value: string[];
  onChange: (value: string[]) => void;
};

type MediaGalleryProps = GalleryFieldBase & {
  accept: 'media';
  value: PostMediaItem[];
  onChange: (value: PostMediaItem[]) => void;
};

type GalleryFieldProps = ImageGalleryProps | MediaGalleryProps;

export default function GalleryField(props: GalleryFieldProps) {
  const { label, help } = props;
  const acceptMedia = props.accept === 'media';
  const items = asMediaItems(props.value);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const { inputRef, openFilePicker } = useFileUploadInput();

  function emit(next: PostMediaItem[]) {
    if (props.accept === 'media') {
      props.onChange(next);
      return;
    }
    props.onChange(next.map((item) => item.url));
  }

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files).filter((file) => (
      acceptMedia
        ? file.type.startsWith('image/') || file.type.startsWith('video/')
        : file.type.startsWith('image/')
    ));
    if (selected.length === 0) return;

    setUploading(true);
    setError(null);
    const uploaded: PostMediaItem[] = [];
    try {
      for (const file of selected) {
        const item = acceptMedia ? await uploadMediaFile(file) : await uploadImageFile(file);
        uploaded.push({
          url: item.url,
          type: item.kind === 'video' || file.type.startsWith('video/') ? 'video' : 'image',
        });
        if (libraryOpen) {
          setLibraryItems((current) => [item, ...current]);
        }
      }
      emit([...items, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
      if (uploaded.length > 0) emit([...items, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    setError(null);
    try {
      setLibraryItems(await fetchMediaLibrary({ includeVideo: acceptMedia }));
    } catch (libraryError) {
      setError(libraryError instanceof Error ? libraryError.message : 'Failed to load media library');
      setLibraryItems([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) void uploadFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
  }

  function addFromLibrary(item: MediaLibraryItem) {
    if (items.some((current) => current.url === item.url)) return;
    emit([...items, { url: item.url, type: item.kind === 'video' ? 'video' : 'image' }]);
  }

  function removeAt(index: number) {
    emit(items.filter((_, currentIndex) => currentIndex !== index));
  }

  const selectedUrls = new Set(items.map((item) => item.url));

  return (
    <div className="block text-sm font-medium text-gray-700">
      <span>{label}</span>
      {help && <p className="mt-1 text-xs font-normal text-gray-500">{help}</p>}

      {items.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100">
              {item.type === 'video' ? (
                <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              {item.type === 'video' && (
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Video
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/60 p-1">
                <button type="button" disabled={index === 0} onClick={() => emit(reorder(items, index, -1))} className="rounded px-1 text-xs text-white disabled:opacity-40" title="Move earlier">←</button>
                <button type="button" onClick={() => removeAt(index)} className="rounded px-1 text-xs text-white" title="Remove">✕</button>
                <button type="button" disabled={index === items.length - 1} onClick={() => emit(reorder(items, index, 1))} className="rounded px-1 text-xs text-white disabled:opacity-40" title="Move later">→</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-2 rounded-md border-2 border-dashed p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={acceptMedia ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*'}
            multiple
            disabled={uploading}
            onChange={handleFileInput}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={openFilePicker}
            className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : acceptMedia ? 'Add photos or video' : 'Add photos'}
          </button>
          <button
            type="button"
            onClick={() => void openLibrary()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Browse library
          </button>
          <span className="text-xs text-gray-500">
            {acceptMedia ? 'Drop photos or short videos here.' : 'Drop photos here or select multiple files.'}
          </span>
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {libraryOpen && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Media library</p>
            <button type="button" onClick={() => setLibraryOpen(false)} className="text-xs text-gray-600 hover:text-gray-900">
              Close
            </button>
          </div>
          {libraryLoading ? (
            <p className="text-xs text-gray-500">Loading media...</p>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-gray-500">No uploaded media yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {libraryItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => addFromLibrary(item)}
                  className={`relative aspect-square overflow-hidden rounded border ${selectedUrls.has(item.url) ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-gray-400'}`}
                  title={item.filename}
                >
                  {item.kind === 'video' ? (
                    <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
