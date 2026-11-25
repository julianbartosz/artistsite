import { BlobServiceClient } from '@azure/storage-blob';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { isGifUrl, parseVariantFilename, type ImageVariantMap, type ImageVariantSize } from '@/lib/image-variant-url';
import { buildImageVariants } from '@/lib/image-variants';

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
  uploadedAt?: string;
  /** Resized WebP copies that actually exist in storage for this image. */
  variants?: ImageVariantMap;
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
    throw new StorageConfigurationError('Media storage is not configured for production. Set AZURE_STORAGE_CONNECTION_STRING in your hosting environment.');
  }

  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.startsWith('.')) {
    throw new Error('Invalid media filename');
  }

  const directory = resolve(LOCAL_UPLOAD_ROOT, folder);
  if (!existsSync(directory)) {
    await mkdir(directory, { recursive: true });
  }

  const filepath = resolve(directory, safeName);
  if (!filepath.startsWith(`${directory}/`)) {
    throw new Error('Invalid media file path');
  }
  if (!existsSync(filepath)) {
    await writeFile(filepath, buffer);
  }

  return {
    url: `/uploads/${folder}/${safeName}`,
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

type StoredFile = { filename: string; url: string; modifiedAt: number };

/** Newest first. `uploadedAt` is an ISO timestamp, so comparing the strings orders by time. */
function sortLibraryItems(items: MediaLibraryItem[]): MediaLibraryItem[] {
  return items.sort((a, b) => (
    (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '') || b.filename.localeCompare(a.filename)
  ));
}

/**
 * Turn a raw folder listing into library items: resized variants are folded into
 * their original (so each photo appears once) and exposed as `variants`.
 */
function toLibraryItems(
  files: StoredFile[],
  folder: MediaFolder,
  provider: StoredAsset['provider'],
): MediaLibraryItem[] {
  const variantsByStem = new Map<string, ImageVariantMap>();
  const originals: StoredFile[] = [];

  for (const file of files) {
    const variant = folder === 'images' ? parseVariantFilename(file.filename) : null;
    if (variant) {
      variantsByStem.set(variant.stem, { ...variantsByStem.get(variant.stem), [variant.size]: file.url });
    } else {
      originals.push(file);
    }
  }

  return originals.map((file) => {
    const dot = file.filename.lastIndexOf('.');
    const variants = variantsByStem.get(dot > 0 ? file.filename.slice(0, dot) : file.filename);
    return {
      url: file.url,
      filename: file.filename,
      provider,
      kind: folderKind(folder),
      ...(file.modifiedAt > 0 ? { uploadedAt: new Date(file.modifiedAt).toISOString() } : {}),
      ...(variants ? { variants } : {}),
    };
  });
}

async function listLocalFolder(folder: MediaFolder): Promise<MediaLibraryItem[]> {
  const directory = join(LOCAL_UPLOAD_ROOT, folder);
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map(async (entry): Promise<StoredFile> => {
        let modifiedAt = 0;
        try {
          modifiedAt = (await stat(join(directory, entry.name))).mtimeMs;
        } catch {
          modifiedAt = 0;
        }
        return { filename: entry.name, url: `/uploads/${folder}/${entry.name}`, modifiedAt };
      }),
  );

  return toLibraryItems(files, folder, 'local');
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
  const files: StoredFile[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix: `${folder}/` })) {
    const filename = blob.name.slice(folder.length + 1);
    if (!filename) continue;
    const lastModified = blob.properties.lastModified;
    files.push({
      filename,
      url: publicBaseUrl ? `${publicBaseUrl}/${folder}/${filename}` : containerClient.getBlockBlobClient(blob.name).url,
      modifiedAt: lastModified instanceof Date ? lastModified.getTime() : 0,
    });
  }

  return toLibraryItems(files, folder, 'azure_blob');
}

async function listFolderRaw(folder: MediaFolder): Promise<MediaLibraryItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();
  return connectionString && containerName
    ? listAzureFolder(folder)
    : listLocalFolder(folder);
}

export async function listStoredImages(): Promise<MediaLibraryItem[]> {
  return sortLibraryItems(await listFolderRaw('images'));
}

export async function listStoredMedia(): Promise<MediaLibraryItem[]> {
  const [images, videos] = await Promise.all([listFolderRaw('images'), listFolderRaw('videos')]);
  return sortLibraryItems([...videos, ...images]);
}

async function readStoredImageBuffer(filename: string): Promise<Buffer | null> {
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.startsWith('.')) {
    return null;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = getAzureContainerName();
  if (connectionString && containerName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(`images/${safeName}`);
    if (!(await blobClient.exists())) return null;
    return blobClient.downloadToBuffer();
  }

  const directory = resolve(LOCAL_UPLOAD_ROOT, 'images');
  const filepath = resolve(directory, safeName);
  if (!filepath.startsWith(`${directory}/`) || !existsSync(filepath)) {
    return null;
  }
  return readFile(filepath);
}

export interface VariantBackfillSummary {
  scanned: number;
  generatedImages: number;
  generatedVariants: number;
  skipped: number;
  failed: string[];
}

const REQUIRED_VARIANTS: ImageVariantSize[] = ['thumb', 'md', 'lg'];

/**
 * Idempotently generate missing WebP variants (-thumb, -md, -lg) for existing stored images.
 * Works for both local public/uploads and Azure Blob Storage without modifying originals.
 */
export async function backfillMissingImageVariants(): Promise<VariantBackfillSummary> {
  const images = await listFolderRaw('images');
  const summary: VariantBackfillSummary = {
    scanned: images.length,
    generatedImages: 0,
    generatedVariants: 0,
    skipped: 0,
    failed: [],
  };

  for (const item of images) {
    if (/\.svg$/i.test(item.filename)) {
      summary.skipped += 1;
      continue;
    }
    const requiredForItem: readonly ImageVariantSize[] = isGifUrl(item.filename)
      ? ['thumb']
      : REQUIRED_VARIANTS;
    const missing = requiredForItem.filter((size) => !item.variants?.[size]);
    if (missing.length === 0) {
      summary.skipped += 1;
      continue;
    }

    try {
      const buffer = await readStoredImageBuffer(item.filename);
      if (!buffer) {
        summary.skipped += 1;
        continue;
      }

      const generated = await buildImageVariants(buffer, item.filename);
      if (generated.length === 0) {
        summary.skipped += 1;
        continue;
      }

      let createdForItem = 0;
      for (const variant of generated) {
        const size = variant.suffix as ImageVariantSize;
        if (item.variants?.[size]) continue;
        await storeImageAsset(variant.buffer, variant.filename, variant.contentType);
        createdForItem += 1;
        summary.generatedVariants += 1;
      }

      if (createdForItem > 0) {
        summary.generatedImages += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      console.warn(`Variant backfill skipped for ${item.filename}:`, error);
      summary.failed.push(item.filename);
    }
  }

  return summary;
}
