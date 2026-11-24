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
export const IMAGE_FILE_ACCEPT = 'image/*,.heic,.heif,.avif,.tif,.tiff,.bmp,.ico,.jfif,.svg';
export const MEDIA_FILE_ACCEPT = `${IMAGE_FILE_ACCEPT},video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,.mp4,.webm,.mov,.m4v,.ogv`;

const MAX_CLIENT_TRANSCODE_DIMENSION = 2800;
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'apng', 'webp', 'gif',
  'heic', 'heif', 'avif', 'tif', 'tiff', 'bmp', 'dib', 'ico', 'cur',
  'svg', 'jp2', 'j2k', 'jxl',
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg']);

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isSupportedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExt(file.name));
}

export function isSupportedVideoFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (VIDEO_MIME_TYPES.has(type)) return true;
  return VIDEO_EXTENSIONS.has(fileExt(file.name));
}

export function isSupportedMediaFile(file: File): boolean {
  return isSupportedImageFile(file) || isSupportedVideoFile(file);
}

/**
 * Fallback for exotic browser-decodable image formats (e.g. JPEG XL on Safari or future OS codecs)
 * that the server's native decoders do not recognize. Never called for GIFs or already-accepted images.
 */
async function transcodeImageInBrowser(file: File): Promise<File | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return null;
  if ((file.type || '').toLowerCase() === 'image/gif' || fileExt(file.name) === 'gif') return null;

  let width = 0;
  let height = 0;
  let drawSource: CanvasImageSource | null = null;
  let cleanup: (() => void) | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
      cleanup = () => bitmap.close();
    }
  } catch {
    drawSource = null;
  }

  if (!drawSource) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Browser image decode failed'));
        element.src = objectUrl;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      drawSource = img;
      cleanup = () => URL.revokeObjectURL(objectUrl);
    } catch {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
  }

  try {
    if (width <= 0 || height <= 0) return null;
    const scale = Math.min(1, MAX_CLIENT_TRANSCODE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(drawSource, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.png`, { type: 'image/png' });
  } finally {
    cleanup?.();
  }
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

async function postUploadWithImageFallback(
  file: File,
  fieldName: 'image' | 'file',
  allowBrowserTranscode: boolean,
  fallbackMessage: string,
): Promise<MediaLibraryItem> {
  const send = async (payloadFile: File) => {
    const formData = new FormData();
    formData.append(fieldName, payloadFile);
    return fetch('/api/upload/image', { method: 'POST', body: formData });
  };

  let response = await send(file);
  if (response.status === 400 && allowBrowserTranscode) {
    const converted = await transcodeImageInBrowser(file);
    if (converted) {
      response = await send(converted);
    }
  }

  const data = await parseUploadResponse(response, fallbackMessage);
  return {
    url: String(data.url || ''),
    filename: String(data.filename || data.url || ''),
    kind: data.kind === 'video' ? 'video' : 'image',
    variants: data.variants as ImageVariantMap | undefined,
  };
}

export async function uploadImageFile(file: File): Promise<MediaLibraryItem> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Unsupported file format. Please choose an image file.');
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Image is too large. Maximum size is 25MB.');
  }
  return postUploadWithImageFallback(file, 'image', true, 'Image upload failed');
}

export async function uploadMediaFile(file: File): Promise<MediaLibraryItem> {
  const isVideo = isSupportedVideoFile(file);
  const isImage = isSupportedImageFile(file);
  if (!isImage && !isVideo) {
    throw new Error('Unsupported file format. Upload an image or an MP4, WebM, or MOV video.');
  }
  if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error('Video is too large. Maximum size is 80MB.');
  }
  if (!isVideo && file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Image is too large. Maximum size is 25MB.');
  }
  return postUploadWithImageFallback(file, 'file', !isVideo, 'Media upload failed');
}

export async function fetchMediaLibrary(options?: { includeVideo?: boolean }): Promise<MediaLibraryItem[]> {
  const params = new URLSearchParams({ library: '1' });
  if (options?.includeVideo) params.set('media', '1');
  const response = await fetch(`/api/upload/image?${params.toString()}`, { cache: 'no-store' });
  const data = await parseUploadResponse(response, 'Failed to load media library');
  return Array.isArray(data.items) ? (data.items as MediaLibraryItem[]) : [];
}
