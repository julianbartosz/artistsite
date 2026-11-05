import fs from 'fs';
import path from 'path';
import { PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';

/**
 * Resolve a public site asset URL for rendering.
 * Remote URLs pass through. Local `/…` paths that are missing on disk fall back
 * so Next/Image never points at a 404 (which paints a broken thumbnail).
 */
export function resolvePublicAssetUrl(
  url: string | null | undefined,
  fallback: string = PRODUCT_IMAGE_FALLBACK,
): string {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith('/')) return trimmed;

  const relative = trimmed.slice(1);
  const diskPath = path.join(process.cwd(), 'public', relative);
  try {
    return fs.existsSync(diskPath) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}
