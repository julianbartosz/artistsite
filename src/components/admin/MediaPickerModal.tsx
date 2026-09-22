'use client';

import React, { useState } from 'react';
import { fetchMediaLibrary, uploadImageFile, type MediaLibraryItem } from '@/lib/image-upload-client';
import { pickVariantUrl } from '@/lib/image-variant-url';

type MediaPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export default function MediaPickerModal({ open, onClose, onSelect }: MediaPickerModalProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadLibrary() {
    if (loaded || libraryLoading) return;
    setLibraryLoading(true);
    setError(null);
    try {
      setLibraryItems(await fetchMediaLibrary());
      setLoaded(true);
    } catch (libraryError) {
      setError(libraryError instanceof Error ? libraryError.message : 'Failed to load media library');
    } finally {
      setLibraryLoading(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const item = await uploadImageFile(file);
      onSelect(item.url);
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  if (!loaded && !libraryLoading) void loadLibrary();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Choose image">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Insert image</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            {uploading ? 'Uploading...' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
              className="sr-only"
            />
          </label>
          <span className="text-xs text-gray-500">Upload a new photo or pick from your library.</span>
        </div>

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        {libraryLoading ? (
          <p className="text-sm text-gray-500">Loading library...</p>
        ) : libraryItems.length === 0 ? (
          <p className="text-sm text-gray-500">No images yet. Upload one to get started.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {libraryItems.map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => {
                  onSelect(item.url);
                  onClose();
                }}
                className="relative aspect-square overflow-hidden rounded border border-gray-200 hover:border-gray-400"
                title={item.filename}
              >
                <img src={pickVariantUrl(item.url, 'thumb')} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
