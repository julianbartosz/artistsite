import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { decodeNonSharpRaster, heicBufferToJpeg, isMissingHevcDecoderError } from '@/lib/heic-decode';
import { backfillMissingImageVariants, listStoredImages, listStoredMedia, StorageConfigurationError, storeMediaAsset } from '@/lib/storage';
import { buildImageVariants } from '@/lib/image-variants';

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 80 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2800;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'];
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'apng', 'webp', 'gif',
  'heic', 'heif', 'avif', 'tif', 'tiff', 'bmp', 'dib', 'ico', 'cur',
  'svg', 'jp2', 'j2k', 'jxl',
]);
const VIDEO_EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
};

const VIDEO_MIME_TO_STORED: Record<string, { ext: string; contentType: string }> = {
  'video/mp4': { ext: 'mp4', contentType: 'video/mp4' },
  'video/x-m4v': { ext: 'mp4', contentType: 'video/mp4' },
  'video/webm': { ext: 'webm', contentType: 'video/webm' },
  'video/quicktime': { ext: 'mov', contentType: 'video/quicktime' },
  'video/ogg': { ext: 'ogv', contentType: 'video/ogg' },
};

function fileExtension(name: string | undefined): string {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function classifyUpload(file: File): { kind: 'image' | 'video' | null; videoMime?: string } {
  const mime = (file.type || '').toLowerCase().trim();
  const ext = fileExtension(file.name);

  if (ALLOWED_VIDEO_TYPES.includes(mime)) {
    return { kind: 'video', videoMime: mime };
  }
  if (mime.startsWith('image/')) {
    return { kind: 'image' };
  }
  // Browsers on Windows/Android/Safari often omit MIME for HEIC/HEIF/AVIF/ICO/BMP or send octet-stream.
  if (!mime || mime === 'application/octet-stream') {
    if (VIDEO_EXT_TO_MIME[ext]) {
      return { kind: 'video', videoMime: VIDEO_EXT_TO_MIME[ext] };
    }
    if (IMAGE_EXTENSIONS.has(ext) || !ext) {
      return { kind: 'image' };
    }
  }
  if (VIDEO_EXT_TO_MIME[ext] && mime.startsWith('video/')) {
    return { kind: 'video', videoMime: VIDEO_EXT_TO_MIME[ext] };
  }
  return { kind: null };
}

function hasValidVideoSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'video/webm') {
    return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }
  if (mimeType === 'video/ogg') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  // ISO Base Media File Format (MP4 / M4V / QuickTime MOV) starts with a box header; `ftyp` or `moov`/`mdat`/`wide`/`free` at offset 4.
  const boxType = buffer.subarray(4, 8).toString('ascii');
  return boxType === 'ftyp' || boxType === 'moov' || boxType === 'mdat' || boxType === 'wide' || boxType === 'free';
}

type NormalizedImage = {
  buffer: Buffer;
  extension: string;
  contentType: string;
  animated?: boolean;
};

async function encodeWebSafeRaster(source: Sharp, hasAlpha: boolean | undefined): Promise<NormalizedImage> {
  const pipeline = source
    .rotate()
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true });
  if (hasAlpha) {
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

async function normalizeUploadedImage(buffer: Buffer): Promise<NormalizedImage | null> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { animated: true }).metadata();
  } catch {
    // Handle common desktop raster formats sharp/libvips doesn't decode natively (BMP, ICO/CUR).
    const decoded = decodeNonSharpRaster(buffer);
    if (!decoded) return null;
    if (decoded.kind === 'encoded') {
      return normalizeUploadedImage(decoded.buffer);
    }
    return encodeWebSafeRaster(
      sharp(decoded.data, {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
      }),
      decoded.hasAlpha,
    );
  }

  const format = metadata.format;
  if (!format) return null;

  const isAnimated = (metadata.pages ?? 1) > 1;
  if (format === 'gif') {
    if (isAnimated) {
      return { buffer, extension: 'gif', contentType: 'image/gif', animated: true };
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
      return { buffer, extension: 'webp', contentType: 'image/webp', animated: true };
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

  // Rasterize SVGs cleanly to PNG so vector uploads work everywhere with zero stored-XSS risk.
  if (format === 'svg') {
    const normalized = await sharp(buffer, { density: 300 })
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
    return { buffer: normalized, extension: 'png', contentType: 'image/png' };
  }

  // Convert HEIC/HEIF, AVIF, TIFF, JP2K, JXL, and any other sharp-decodable format into web-safe PNG/JPEG.
  try {
    return await encodeWebSafeRaster(sharp(buffer), metadata.hasAlpha);
  } catch (error) {
    // Prebuilt sharp cannot decode HEVC HEIC on Linux (and often macOS); fall back to WASM libheif.
    if (format === 'heif' && isMissingHevcDecoderError(error)) {
      const jpegBuffer = await heicBufferToJpeg(buffer);
      return encodeWebSafeRaster(sharp(jpegBuffer), false);
    }
    throw error;
  }
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
        { error: 'Invalid file type. Upload an image or an MP4, WebM, or MOV video.' },
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
    let skipVariants = false;
    if (isImage) {
      const normalized = await normalizeUploadedImage(buffer);
      if (!normalized) {
        return NextResponse.json(
          { error: 'Could not read this image file. Try another image or convert it to PNG or JPEG.' },
          { status: 400 }
        );
      }
      buffer = normalized.buffer;
      extension = normalized.extension;
      verifiedContentType = normalized.contentType;
      skipVariants = Boolean(normalized.animated || extension === 'gif');
    } else {
      const videoMime = classified.videoMime || file.type;
      if (!hasValidVideoSignature(buffer, videoMime)) {
        return NextResponse.json(
          { error: 'Uploaded file is not a valid MP4, WebM, or MOV video.' },
          { status: 400 }
        );
      }
      const mapped = VIDEO_MIME_TO_STORED[videoMime] || { ext: 'mp4', contentType: 'video/mp4' };
      extension = mapped.ext;
      verifiedContentType = mapped.contentType;
    }

    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const filename = `${hash}.${extension}`;
    const storedAsset = await storeMediaAsset(buffer, filename, verifiedContentType);

    const variants: Record<string, string> = {};
    if (isImage && !skipVariants) {
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
      allowedImageTypes: ['image/*'],
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

export async function PUT() {
  try {
    await requireAdmin();
    const summary = await backfillMissingImageVariants();
    return NextResponse.json({ success: true, ...summary });
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

    console.error('Media variant backfill error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill image variants' },
      { status: 500 }
    );
  }
}
