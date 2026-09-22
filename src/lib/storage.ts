import { BlobServiceClient } from '@azure/storage-blob';
import { existsSync } from 'fs';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { join } from 'path';

type MediaFolder = 'images' | 'videos';

const LOCAL_UPLOAD_ROOT = join(process.cwd(), 'public', 'uploads');

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

export interface MediaLibraryItem {
  url: string;
  filename: string;
  provider: StoredAsset['provider'];
  kind: 'image' | 'video';
}

function folderKind(folder: MediaFolder): MediaLibraryItem['kind'] {
  return folder === 'videos' ? 'video' : 'image';
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

async function storeLocal(buffer: Buffer, filename: string, folder: MediaFolder): Promise<StoredAsset> {
  if (process.env.NODE_ENV === 'production') {
    throw new StorageConfigurationError('Image storage is not set up for production. Ask your host to connect Azure blob storage in Settings.');
  }

  const directory = join(LOCAL_UPLOAD_ROOT, folder);
  if (!existsSync(directory)) {
    await mkdir(directory, { recursive: true });
  }

  const filepath = join(directory, filename);
  if (!existsSync(filepath)) {
    await writeFile(filepath, buffer);
  }

  return {
    url: `/uploads/${folder}/${filename}`,
    provider: 'local',
  };
}

async function storeAsset(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: MediaFolder,
): Promise<StoredAsset> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();

  if (!connectionString || !containerName) {
    return storeLocal(buffer, filename, folder);
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: 'blob' });

  const blobClient = containerClient.getBlockBlobClient(`${folder}/${filename}`);
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
    url: publicBaseUrl ? `${publicBaseUrl}/${folder}/${filename}` : blobClient.url,
    provider: 'azure_blob',
  };
}

export async function storeImageAsset(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<StoredAsset> {
  return storeAsset(buffer, filename, contentType, 'images');
}

export async function storeMediaAsset(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<StoredAsset> {
  const folder: MediaFolder = contentType.startsWith('video/') ? 'videos' : 'images';
  return storeAsset(buffer, filename, contentType, folder);
}

async function listLocalFolder(folder: MediaFolder): Promise<MediaLibraryItem[]> {
  const directory = join(LOCAL_UPLOAD_ROOT, folder);
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      url: `/uploads/${folder}/${entry.name}`,
      filename: entry.name,
      provider: 'local' as const,
      kind: folderKind(folder),
    }));
}

async function listAzureFolder(folder: MediaFolder): Promise<MediaLibraryItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();
  if (!connectionString || !containerName) {
    return listLocalFolder(folder);
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const publicBaseUrl = getAzurePublicBaseUrl(containerName);
  const items: MediaLibraryItem[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix: `${folder}/` })) {
    const filename = blob.name.slice(folder.length + 1);
    if (!filename) continue;
    items.push({
      url: publicBaseUrl ? `${publicBaseUrl}/${folder}/${filename}` : containerClient.getBlockBlobClient(blob.name).url,
      filename,
      provider: 'azure_blob',
      kind: folderKind(folder),
    });
  }

  return items;
}

async function listFolder(folder: MediaFolder): Promise<MediaLibraryItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();
  const items = connectionString && containerName
    ? await listAzureFolder(folder)
    : await listLocalFolder(folder);
  return items.sort((a, b) => b.filename.localeCompare(a.filename));
}

export async function listStoredImages(): Promise<MediaLibraryItem[]> {
  return listFolder('images');
}

export async function listStoredMedia(): Promise<MediaLibraryItem[]> {
  const [images, videos] = await Promise.all([listFolder('images'), listFolder('videos')]);
  return [...videos, ...images].sort((a, b) => b.filename.localeCompare(a.filename));
}
