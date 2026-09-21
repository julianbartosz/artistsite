export type ImageVariantMap = Partial<Record<'thumb' | 'md' | 'lg', string>>;

export type MediaLibraryItem = {
  url: string;
  filename: string;
  kind?: 'image' | 'video';
  variants?: ImageVariantMap;
};

export async function uploadImageFile(file: File): Promise<MediaLibraryItem> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Image upload failed');
  return {
    url: data.url,
    filename: data.filename || data.url,
    kind: data.kind === 'video' ? 'video' : 'image',
    variants: data.variants,
  };
}

export async function uploadMediaFile(file: File): Promise<MediaLibraryItem> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Media upload failed');
  return {
    url: data.url,
    filename: data.filename || data.url,
    kind: data.kind === 'video' ? 'video' : 'image',
    variants: data.variants,
  };
}

export async function fetchMediaLibrary(options?: { includeVideo?: boolean }): Promise<MediaLibraryItem[]> {
  const params = new URLSearchParams({ library: '1' });
  if (options?.includeVideo) params.set('media', '1');
  const response = await fetch(`/api/upload/image?${params.toString()}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to load media library');
  return Array.isArray(data.items) ? data.items : [];
}
