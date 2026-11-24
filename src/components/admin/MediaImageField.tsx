'use client';

import React, { ChangeEvent, DragEvent, useEffect, useId, useRef, useState } from 'react';
import { IMAGE_FILE_ACCEPT, isSupportedImageFile, uploadImageFile } from '@/lib/image-upload-client';
import MediaPickerModal from '@/components/admin/MediaPickerModal';
import MediaThumb from '@/components/admin/MediaThumb';
import { useFileUploadInput } from '@/components/admin/useFileUploadInput';

type MediaImageFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
};

const ACTION_BUTTON = 'inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';

/** One photo slot: shows the current photo with upload, library, and remove actions. */
export default function MediaImageField({ label, value, onChange, help }: MediaImageFieldProps) {
  const linkInputId = useId();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const { inputRef, openFilePicker } = useFileUploadInput();

  // An upload can finish after other fields were edited; hand the result to the newest
  // onChange so the parent form never rebuilds itself from the state it had when the upload began.
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });

  async function upload(file: File) {
    if (!isSupportedImageFile(file)) {
      setError('Unsupported file format. Please choose an image file.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const item = await uploadImageFile(file);
      latestOnChange.current(item.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void upload(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="text-sm font-medium text-gray-700" role="group" aria-label={label}>
      <span className="block">{label}</span>
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-1 flex items-center gap-3 rounded-md border-2 border-dashed p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
      >
        {value && (
          <MediaThumb src={value} fit="contain" sizes="96px" className="h-20 w-20 shrink-0 rounded border border-gray-200" />
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            disabled={uploading}
            onChange={handleFileInput}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={uploading} onClick={openFilePicker} className={ACTION_BUTTON}>
              {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload photo'}
            </button>
            <button type="button" onClick={() => setLibraryOpen(true)} className={ACTION_BUTTON}>
              Library
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setError(null);
                }}
                className={`${ACTION_BUTTON} hover:text-red-700`}
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 text-xs font-normal text-gray-500">Any image format · up to 25 MB</p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      {help && <p className="mt-1 text-xs font-normal text-gray-500">{help}</p>}
      {linkOpen ? (
        <label htmlFor={linkInputId} className="mt-2 block text-xs font-medium text-gray-700">
          Image link
          <input
            id={linkInputId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/photo.jpg"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setLinkOpen(true)}
          className="mt-1 inline-flex min-h-8 items-center text-xs font-normal text-gray-500 underline underline-offset-2 hover:text-gray-800"
        >
          Use an image link instead
        </button>
      )}
      <MediaPickerModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title={label}
        allowUpload={false}
        selectedUrls={value ? [value] : []}
        onSelect={(url) => {
          onChange(url);
          setError(null);
        }}
      />
    </div>
  );
}
