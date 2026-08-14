import { BlobServiceClient } from '@azure/storage-blob';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const LOCAL_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'images');

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export interface StoredAsset {
  url: string;
  provider: 'azure_blob' | 'local';
}

function getAzureContainerName(): string | undefined {
  return process.env.AZURE_STORAGE_CONTAINER || process.env.AZURE_BLOB_CONTAINER || 'artist-site-assets';
}

function getAzurePublicBaseUrl(containerName: string): string | undefined {
  if (process.env.AZURE_STORAGE_PUBLIC_BASE_URL) {
    return process.env.AZURE_STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (!accountName) return undefined;

  return `https://${accountName}.blob.core.windows.net/${containerName}`;
}

async function storeLocal(buffer: Buffer, filename: string): Promise<StoredAsset> {
  if (process.env.NODE_ENV === 'production') {
    throw new StorageConfigurationError('Production image storage is not configured');
  }

  if (!existsSync(LOCAL_UPLOAD_DIR)) {
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  }

  const filepath = join(LOCAL_UPLOAD_DIR, filename);
  if (!existsSync(filepath)) {
    await writeFile(filepath, buffer);
  }

  return {
    url: `/uploads/images/${filename}`,
    provider: 'local',
  };
}

export async function storeImageAsset(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<StoredAsset> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();

  if (!connectionString || !containerName) {
    return storeLocal(buffer, filename);
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: 'blob' });

  const blobClient = containerClient.getBlockBlobClient(`images/${filename}`);
  if (!(await blobClient.exists())) {
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }

  const publicBaseUrl = getAzurePublicBaseUrl(containerName);
  return {
    url: publicBaseUrl ? `${publicBaseUrl}/images/${filename}` : blobClient.url,
    provider: 'azure_blob',
  };
}