import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { listStoredImages, listStoredMedia, StorageConfigurationError, storeMediaAsset } from '@/lib/storage';
import { buildImageVariants } from '@/lib/image-variants';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 80 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

function isImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type);
}

function isVideoType(type: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(type);
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

    const isVideo = isVideoType(file.type);
    const isImage = isImageType(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, WebP, GIF, MP4, WebM, or MOV.' },
        { status: 400 }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: isVideo ? 'Video is too large. Maximum size is 80MB.' : 'Image is too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const extension = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const filename = `${hash}.${extension}`;
    const storedAsset = await storeMediaAsset(buffer, filename, file.type);

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
      size: file.size,
      type: file.type,
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
