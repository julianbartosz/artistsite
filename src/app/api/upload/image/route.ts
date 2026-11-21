import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sharp, { type Metadata } from 'sharp';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { listStoredImages, listStoredMedia, StorageConfigurationError, storeMediaAsset } from '@/lib/storage';
import { buildImageVariants } from '@/lib/image-variants';

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 80 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2800;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tif', 'tiff']);
const VIDEO_EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function fileExtension(name: string | undefined): string {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function classifyUpload(file: File): { kind: 'image' | 'video' | null; videoMime?: string } {
  const mime = (file.type || '').toLowerCase();
  if (ALLOWED_VIDEO_TYPES.includes(mime)) {
    return { kind: 'video', videoMime: mime };
  }
  if (ALLOWED_IMAGE_TYPES.includes(mime)) {
    return { kind: 'image' };
  }
  // Browsers on Windows/Android often omit MIME for HEIC/HEIF or send octet-stream.
  if (!mime || mime === 'application/octet-stream') {
    const ext = fileExtension(file.name);
    if (VIDEO_EXT_TO_MIME[ext]) {
      return { kind: 'video', videoMime: VIDEO_EXT_TO_MIME[ext] };
    }
    if (IMAGE_EXTENSIONS.has(ext)) {
      return { kind: 'image' };
    }
  }
  return { kind: null };
}

function hasValidVideoSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'video/webm') {
    return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }
  // ISO Base Media File Format (MP4 / QuickTime MOV) starts with a box header; `ftyp` or `moov`/`mdat`/`wide`/`free` at offset 4.
  const boxType = buffer.subarray(4, 8).toString('ascii');
  return boxType === 'ftyp' || boxType === 'moov' || boxType === 'mdat' || boxType === 'wide' || boxType === 'free';
}

async function normalizeUploadedImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  extension: string;
  contentType: string;
} | null> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { animated: true }).metadata();
  } catch {
    return null;
  }

  const format = metadata.format;
  if (!format) return null;

  const isAnimated = (metadata.pages ?? 1) > 1;
  if (format === 'gif') {
    if (isAnimated) {
      return { buffer, extension: 'gif', contentType: 'image/gif' };
    }
    const normalized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .gif()
      .toBuffer();
    return { buffer: normalized, extension: 'gif', contentType: 'image/gif' };
  }

  if (format === 'webp') {
    if (isAnimated) {
      return { buffer, extension: 'webp', contentType: 'image/webp' };
    }
    const normalized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    return { buffer: normalized, extension: 'webp', contentType: 'image/webp' };
  }

  if (format === 'png') {
    const normalized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
    return { buffer: normalized, extension: 'png', contentType: 'image/png' };
  }

  if (format === 'jpeg') {
    const normalized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    return { buffer: normalized, extension: 'jpg', contentType: 'image/jpeg' };
  }

  // Convert iPhone HEIC/HEIF, AVIF, and studio TIFFs into universally viewable web images.
  if (format === 'heif' || format === 'tiff') {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true });
    if (metadata.hasAlpha) {
      return {
        buffer: await pipeline.png({ compressionLevel: 8 }).toBuffer(),
        extension: 'png',
        contentType: 'image/png',
      };
    }
    return {
      buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
      extension: 'jpg',
      contentType: 'image/jpeg',
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = (formData.get('file') || formData.get('image') || formData.get('video')) as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No media file provided' },
        { status: 400 }
      );
    }

    const classified = classifyUpload(file);
    const isVideo = classified.kind === 'video';
    const isImage = classified.kind === 'image';

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, WebP, GIF, HEIC, MP4, WebM, or MOV.' },
        { status: 400 }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: isVideo ? 'Video is too large. Maximum size is 80MB.' : 'Image is too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);

    let extension: string;
    let verifiedContentType = classified.videoMime || file.type;
    if (isImage) {
      const normalized = await normalizeUploadedImage(buffer);
      if (!normalized) {
        return NextResponse.json(
          { error: 'Uploaded file is not a supported image. Use JPEG, PNG, WebP, GIF, or HEIC.' },
          { status: 400 }
        );
      }
      buffer = normalized.buffer;
      extension = normalized.extension;
      verifiedContentType = normalized.contentType;
    } else {
      const videoMime = classified.videoMime || file.type;
      if (!hasValidVideoSignature(buffer, videoMime)) {
        return NextResponse.json(
          { error: 'Uploaded file is not a valid MP4, WebM, or MOV video.' },
          { status: 400 }
        );
      }
      extension = VIDEO_MIME_TO_EXT[videoMime] || 'mp4';
      verifiedContentType = videoMime;
    }

    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const filename = `${hash}.${extension}`;
    const storedAsset = await storeMediaAsset(buffer, filename, verifiedContentType);

    const variants: Record<string, string> = {};
    if (isImage) {
      try {
        const generated = await buildImageVariants(buffer, filename);
        for (const variant of generated) {
          const storedVariant = await storeMediaAsset(variant.buffer, variant.filename, variant.contentType);
          variants[variant.suffix] = storedVariant.url;
        }
      } catch (variantError) {
        console.warn('Image variant generation skipped:', variantError);
      }
    }

    return NextResponse.json({
      success: true,
      url: storedAsset.url,
      filename,
      size: buffer.length,
      type: verifiedContentType,
      kind: isVideo ? 'video' : 'image',
      provider: storedAsset.provider,
      variants,
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (error instanceof StorageConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: 'STORAGE_UNCONFIGURED' },
        { status: 503 }
      );
    }

    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const wantsLibrary = request.nextUrl.searchParams.get('library') === '1';
  const includeVideo = request.nextUrl.searchParams.get('media') === '1';

  if (!wantsLibrary) {
    return NextResponse.json({
      message: 'Media upload endpoint',
      maxImageSize: MAX_IMAGE_SIZE,
      maxVideoSize: MAX_VIDEO_SIZE,
      allowedImageTypes: ALLOWED_IMAGE_TYPES,
      allowedVideoTypes: ALLOWED_VIDEO_TYPES,
    });
  }

  try {
    await requireAdmin();
    const items = includeVideo ? await listStoredMedia() : await listStoredImages();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Media library list error:', error);
    return NextResponse.json(
      { error: 'Failed to load media library' },
      { status: 500 }
    );
  }
}
