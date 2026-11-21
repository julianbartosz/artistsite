import type { ImageVariantMap } from '@/lib/image-variant-url';

export type { ImageVariantMap };

export type MediaLibraryItem = {
  url: string;
  filename: string;
  kind?: 'image' | 'video';
  uploadedAt?: string;
  variants?: ImageVariantMap;
};

export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 80 * 1024 * 1024;
export const IMAGE_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,.avif,.tif,.tiff';
export const MEDIA_FILE_ACCEPT = `${IMAGE_FILE_ACCEPT},video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov`;

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tif', 'tiff']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isSupportedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml') return false;
  if (type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExt(file.name));
}

export function isSupportedVideoFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'video/mp4' || type === 'video/webm' || type === 'video/quicktime') return true;
  return VIDEO_EXTENSIONS.has(fileExt(file.name));
}

export function isSupportedMediaFile(file: File): boolean {
  return isSupportedImageFile(file) || isSupportedVideoFile(file);
}

async function parseUploadResponse(response: Response, fallbackMessage: string): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('File is too large for the server. Try a smaller image or video.');
    }
    const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : fallbackMessage;
    throw new Error(message);
  }
  if (!data || typeof data !== 'object') {
    throw new Error(fallbackMessage);
  }
  return data as Record<string, unknown>;
}

export async function uploadImageFile(file: File): Promise<MediaLibraryItem> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Unsupported image format. Use JPG, PNG, WebP, GIF, or HEIC.');
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Image is too large. Maximum size is 25MB.');
  }
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
  const data = await parseUploadResponse(response, 'Image upload failed');
  return {
    url: String(data.url || ''),
    filename: String(data.filename || data.url || ''),
    kind: data.kind === 'video' ? 'video' : 'image',
    variants: data.variants as ImageVariantMap | undefined,
  };
}

export async function uploadMediaFile(file: File): Promise<MediaLibraryItem> {
  const isVideo = isSupportedVideoFile(file);
  const isImage = isSupportedImageFile(file);
  if (!isImage && !isVideo) {
    throw new Error('Unsupported file format. Use JPG, PNG, WebP, GIF, HEIC, MP4, WebM, or MOV.');
  }
  if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error('Video is too large. Maximum size is 80MB.');
  }
  if (!isVideo && file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Image is too large. Maximum size is 25MB.');
  }
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload/image', { method: 'POST', body: formData });
  const data = await parseUploadResponse(response, 'Media upload failed');
  return {
    url: String(data.url || ''),
    filename: String(data.filename || data.url || ''),
    kind: data.kind === 'video' ? 'video' : 'image',
    variants: data.variants as ImageVariantMap | undefined,
  };
}

export async function fetchMediaLibrary(options?: { includeVideo?: boolean }): Promise<MediaLibraryItem[]> {
  const params = new URLSearchParams({ library: '1' });
  if (options?.includeVideo) params.set('media', '1');
  const response = await fetch(`/api/upload/image?${params.toString()}`, { cache: 'no-store' });
  const data = await parseUploadResponse(response, 'Failed to load media library');
  return Array.isArray(data.items) ? (data.items as MediaLibraryItem[]) : [];
}
