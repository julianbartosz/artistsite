'use client';

import React, { ChangeEvent, DragEvent, useState } from 'react';
import { fetchMediaLibrary, uploadImageFile, type MediaLibraryItem } from '@/lib/image-upload-client';
import { useFileUploadInput } from '@/components/admin/useFileUploadInput';

type MediaImageFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
};

export default function MediaImageField({ label, value, onChange, help }: MediaImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const { inputRef, openFilePicker } = useFileUploadInput();

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const item = await uploadImageFile(file);
      onChange(item.url);
      if (libraryOpen) {
        setLibraryItems((current) => [item, ...current]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    setError(null);
    try {
      setLibraryItems(await fetchMediaLibrary());
    } catch (libraryError) {
      setError(libraryError instanceof Error ? libraryError.message : 'Failed to load media library');
      setLibraryItems([]);
    } finally {
      setLibraryLoading(false);
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
    if (file && file.type.startsWith('image/')) void upload(file);
  }

  return (
    <div className="block text-sm font-medium text-gray-700">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        placeholder="/images/example.jpg"
      />
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
            accept="image/*"
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
            {uploading ? 'Uploading...' : 'Upload image'}
          </button>
          <button
            type="button"
            onClick={() => void openLibrary()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Browse library
          </button>
          <span className="text-xs text-gray-500">Drop a photo here or click to browse. JPG or PNG, at least 1200px wide recommended.</span>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
      {value && (
        <img src={value} alt="" className="mt-2 h-24 w-24 rounded object-cover border border-gray-200" />
      )}
      {libraryOpen && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Media library</p>
            <button type="button" onClick={() => setLibraryOpen(false)} className="text-xs text-gray-600 hover:text-gray-900">
              Close
            </button>
          </div>
          {libraryLoading ? (
            <p className="text-xs text-gray-500">Loading images...</p>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-gray-500">No uploaded images yet. Upload one to get started.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {libraryItems.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => {
                    onChange(item.url);
                    setLibraryOpen(false);
                  }}
                  className={`relative aspect-square overflow-hidden rounded border ${value === item.url ? 'border-primary ring-2 ring-primary' : 'border-gray-200 hover:border-gray-400'}`}
                  title={item.filename}
                >
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
