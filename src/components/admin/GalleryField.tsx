'use client';

import React, { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  IMAGE_FILE_ACCEPT,
  isSupportedImageFile,
  isSupportedMediaFile,
  isSupportedVideoFile,
  MEDIA_FILE_ACCEPT,
  uploadImageFile,
  uploadMediaFile,
  type MediaLibraryItem,
} from '@/lib/image-upload-client';
import type { PostMediaItem } from '@/lib/admin-content';
import { isGifUrl } from '@/lib/image-variant-url';
import { reorder } from '@/components/admin/EditorFields';
import MediaPickerModal from '@/components/admin/MediaPickerModal';
import MediaThumb from '@/components/admin/MediaThumb';
import { useFileUploadInput } from '@/components/admin/useFileUploadInput';

function asMediaItems(value: string[] | PostMediaItem[]): PostMediaItem[] {
  return value.map((entry) => (
    typeof entry === 'string' ? { url: entry, type: 'image' as const } : entry
  ));
}

type GalleryFieldBase = {
  label: string;
  help?: string;
  /** Badge shown on the first item when its position is meaningful, e.g. "Cover". */
  firstItemLabel?: string;
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

const ACTION_BUTTON = 'inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';
const TILE_ACTION = 'flex h-9 items-center justify-center text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent';

/** An ordered set of photos (and optionally videos) with upload, library, reorder, and remove. */
export default function GalleryField(props: GalleryFieldProps) {
  const { label, help, firstItemLabel } = props;
  const acceptMedia = props.accept === 'media';
  const items = asMediaItems(props.value);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { inputRef, openFilePicker } = useFileUploadInput();
  const uploading = uploadProgress !== null;

  // Uploads finish long after they start; always apply them to the newest value and handler
  // so edits made in the meantime (here or elsewhere in the form) are never overwritten.
  const latestProps = useRef(props);
  useEffect(() => {
    latestProps.current = props;
  });

  function currentItems(): PostMediaItem[] {
    return asMediaItems(latestProps.current.value);
  }

  function emit(next: PostMediaItem[]) {
    const current = latestProps.current;
    if (current.accept === 'media') {
      current.onChange(next);
      return;
    }
    current.onChange(next.map((item) => item.url));
  }

  function addItem(item: PostMediaItem) {
    const existing = currentItems();
    if (existing.some((entry) => entry.url === item.url)) return;
    emit([...existing, item]);
  }

  async function uploadFiles(files: FileList | File[]) {
    const allFiles = Array.from(files);
    const selected = allFiles.filter((file) => (
      acceptMedia ? isSupportedMediaFile(file) : isSupportedImageFile(file)
    ));
    const skippedCount = allFiles.length - selected.length;
    if (selected.length === 0) {
      setError(
        acceptMedia
          ? 'Unsupported file type. Upload any image or an MP4, WebM, or MOV video.'
          : 'Unsupported file type. Please choose an image file.',
      );
      return;
    }

    const problems: string[] = skippedCount > 0
      ? [`Skipped ${skippedCount} unsupported file${skippedCount === 1 ? '' : 's'}.`]
      : [];
    setError(problems.join(' ') || null);

    for (let i = 0; i < selected.length; i += 1) {
      const file = selected[i];
      setUploadProgress({ current: i + 1, total: selected.length });
      try {
        const item = acceptMedia ? await uploadMediaFile(file) : await uploadImageFile(file);
        addItem({
          url: item.url,
          type: item.kind === 'video' || isSupportedVideoFile(file) ? 'video' : 'image',
        });
      } catch (uploadError) {
        const reason = uploadError instanceof Error ? uploadError.message : 'Upload failed';
        problems.push(selected.length > 1 ? `${file.name}: ${reason}` : reason);
        setError(problems.join(' '));
      }
    }
    setUploadProgress(null);
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

  function toggleFromLibrary(item: MediaLibraryItem) {
    const existing = currentItems();
    if (existing.some((entry) => entry.url === item.url)) {
      emit(existing.filter((entry) => entry.url !== item.url));
      return;
    }
    emit([...existing, { url: item.url, type: item.kind === 'video' ? 'video' : 'image' }]);
  }

  return (
    <div className="text-sm font-medium text-gray-700" role="group" aria-label={label}>
      <span className="block">{label}</span>
      {help && <p className="mt-1 text-xs font-normal text-gray-500">{help}</p>}

      {items.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item, index) => (
            <li key={`${item.url}-${index}`} className="relative overflow-hidden rounded border border-gray-200 bg-white">
              <MediaThumb
                src={item.url}
                kind={item.type === 'video' ? 'video' : 'image'}
                sizes="(max-width: 640px) 33vw, 160px"
                className="aspect-square w-full"
              />
              {index === 0 && firstItemLabel && (
                <span className="absolute left-1 top-1 rounded bg-gray-900/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {firstItemLabel}
                </span>
              )}
              {item.type === 'video' ? (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Video
                </span>
              ) : isGifUrl(item.url) ? (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  GIF
                </span>
              ) : null}
              <div className="grid grid-cols-3 border-t border-gray-200">
                <button type="button" disabled={index === 0} onClick={() => emit(reorder(items, index, -1))} className={TILE_ACTION} aria-label="Move earlier">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => emit(items.filter((_, currentIndex) => currentIndex !== index))} className={`${TILE_ACTION} hover:text-red-700`} aria-label="Remove">
                  <X size={16} aria-hidden="true" />
                </button>
                <button type="button" disabled={index === items.length - 1} onClick={() => emit(reorder(items, index, 1))} className={TILE_ACTION} aria-label="Move later">
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-2 rounded-md border-2 border-dashed p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptMedia ? MEDIA_FILE_ACCEPT : IMAGE_FILE_ACCEPT}
          multiple
          disabled={uploading}
          onChange={handleFileInput}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={uploading} onClick={openFilePicker} className={ACTION_BUTTON}>
            {uploadProgress
              ? (uploadProgress.total > 1 ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…` : 'Uploading…')
              : acceptMedia ? 'Add photos or video' : 'Add photos'}
          </button>
          <button type="button" onClick={() => setLibraryOpen(true)} className={ACTION_BUTTON}>
            Library
          </button>
        </div>
        <p className="mt-2 text-xs font-normal text-gray-500">
          {acceptMedia
            ? 'Any image up to 25 MB (including GIF & HEIC) · videos up to 80 MB (MP4, MOV, WebM)'
            : 'Any image format · up to 25 MB each'}
        </p>
      </div>

      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}

      <MediaPickerModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title={label}
        includeVideo={acceptMedia}
        selectedUrls={items.map((item) => item.url)}
        onToggle={toggleFromLibrary}
      />
    </div>
  );
}
