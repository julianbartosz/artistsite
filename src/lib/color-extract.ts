import { normalizeHexColor } from '@/lib/site-content-shared';

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (channel: number) => Math.min(255, Math.max(0, Math.round(channel)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function isNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 18 || max > 240 || min < 20;
}

/** Sample an image URL in the browser and suggest two distinct brand colors. */
export async function extractPaletteFromImageUrl(
  imageUrl: string,
): Promise<{ primary: string; accent: string } | null> {
  if (typeof window === 'undefined' || !imageUrl.trim()) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        const buckets = new Map<string, { rgb: [number, number, number]; count: number }>();

        for (let index = 0; index < data.length; index += 4) {
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const alpha = data[index + 3];
          if (alpha < 128 || isNeutral(r, g, b)) continue;

          const key = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            buckets.set(key, { rgb: [r, g, b], count: 1 });
          }
        }

        const ranked = Array.from(buckets.values()).sort((left, right) => right.count - left.count);
        if (ranked.length === 0) {
          resolve(null);
          return;
        }

        const primary = ranked[0].rgb;
        const accentCandidate = ranked.find(
          (entry) => colorDistance(entry.rgb, primary) > 60,
        ) ?? ranked[1] ?? ranked[0];

        resolve({
          primary: normalizeHexColor(rgbToHex(primary[0], primary[1], primary[2]), '#111827'),
          accent: normalizeHexColor(rgbToHex(accentCandidate.rgb[0], accentCandidate.rgb[1], accentCandidate.rgb[2]), '#374151'),
        });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}
