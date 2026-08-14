import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { StorageConfigurationError, storeImageAsset } from '@/lib/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create hash of file content for deduplication
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${hash}.${extension}`;
    const storedAsset = await storeImageAsset(buffer, filename, file.type);
    
    return NextResponse.json({
      success: true,
      url: storedAsset.url,
      filename,
      size: file.size,
      type: file.type,
      provider: storedAsset.provider,
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

    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Image upload endpoint',
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES
    }
  );
}