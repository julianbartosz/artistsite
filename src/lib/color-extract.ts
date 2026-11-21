import { ARTWORK_PALETTE_MAX_SWATCHES } from '@/lib/site-content-shared';

type Rgb = [number, number, number];

function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (channel: number) => Math.min(255, Math.max(0, Math.round(channel)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Grays, near-white paper, and near-black shadow carry no brand color. */
function isNeutral([r, g, b]: Rgb): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 24 || min > 235 || max < 28;
}

const SAMPLE_SIZE = 64;
const MIN_SWATCH_DISTANCE = 56;

function sampleCanvasSwatches(src: string, maxSwatches: number): Promise<string[] | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const buckets = new Map<string, { sum: Rgb; count: number }>();

        for (let index = 0; index < data.length; index += 4) {
          const rgb: Rgb = [data[index], data[index + 1], data[index + 2]];
          if (data[index + 3] < 128 || isNeutral(rgb)) continue;
          const key = `${rgb[0] >> 5}-${rgb[1] >> 5}-${rgb[2] >> 5}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.sum[0] += rgb[0];
            bucket.sum[1] += rgb[1];
            bucket.sum[2] += rgb[2];
            bucket.count += 1;
          } else {
            buckets.set(key, { sum: [...rgb], count: 1 });
          }
        }

        const ranked = Array.from(buckets.values())
          .sort((left, right) => right.count - left.count)
          .map(({ sum, count }): Rgb => [sum[0] / count, sum[1] / count, sum[2] / count]);

        const picked: Rgb[] = [];
        for (const candidate of ranked) {
          if (picked.every((existing) => colorDistance(existing, candidate) >= MIN_SWATCH_DISTANCE)) {
            picked.push(candidate);
            if (picked.length === maxSwatches) break;
          }
        }

        resolve(picked.length > 0 ? picked.map(rgbToHex) : null);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function isCrossOriginUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Samples an image in the browser and returns its most prominent distinct colors,
 * most common first. For cross-origin images (such as Azure Blob uploads), routes
 * through Next's same-origin image optimizer first so canvas reads do not fail on CORS.
 */
export async function extractSwatchesFromImageUrl(
  imageUrl: string,
  maxSwatches = ARTWORK_PALETTE_MAX_SWATCHES,
): Promise<string[] | null> {
  if (typeof window === 'undefined' || !imageUrl.trim()) return null;

  const trimmed = imageUrl.trim();
  if (isCrossOriginUrl(trimmed)) {
    const proxied = `/_next/image?url=${encodeURIComponent(trimmed)}&w=128&q=75`;
    const fromProxy = await sampleCanvasSwatches(proxied, maxSwatches);
    if (fromProxy) return fromProxy;
  }

  return sampleCanvasSwatches(trimmed, maxSwatches);
}
