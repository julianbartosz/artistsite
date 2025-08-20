import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'images');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

export async function POST(request: Request) {
  try {
    await ensureUploadDir();
    
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create hash of file content for deduplication
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${hash}.${extension}`;
    const filepath = join(UPLOAD_DIR, filename);
    
    // Check if file already exists (deduplication)
    if (!existsSync(filepath)) {
      await writeFile(filepath, buffer);
    }
    
    // Return public URL
    const url = `/uploads/images/${filename}`;
    
    return json({
      success: true,
      url,
      filename,
      size: file.size,
      type: file.type
    });
    
  } catch (error) {
    console.error('Image upload error:', error);
    return json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return json(
    { 
      message: 'Image upload endpoint',
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES
    }
  );
}