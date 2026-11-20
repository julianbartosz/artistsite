import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FontPreset } from '@/lib/site-content-shared';

type OgWeight = 400 | 600;
type OgFont = { name: string; data: ArrayBuffer; weight: OgWeight; style: 'normal' };

/** Satori cannot read woff2, so generated images use these woff copies of the site families. */
const OG_FONT_FILES = {
  sans: { name: 'Inter', files: { 400: 'inter-latin-400-normal.woff', 600: 'inter-latin-600-normal.woff' } },
  serif: { name: 'Source Serif 4', files: { 400: 'source-serif-4-latin-400-normal.woff', 600: 'source-serif-4-latin-600-normal.woff' } },
  display: { name: 'Fraunces', files: { 600: 'fraunces-latin-600-normal.woff' } },
} as const;

type OgFamily = keyof typeof OG_FONT_FILES;

const HEADING_FAMILY: Record<FontPreset, OgFamily> = {
  system: 'sans',
  serif: 'serif',
  editorial: 'display',
};

const BODY_FAMILY: Record<FontPreset, Exclude<OgFamily, 'display'>> = {
  system: 'sans',
  serif: 'serif',
  editorial: 'sans',
};

const cache = new Map<string, Promise<ArrayBuffer>>();

function loadFile(file: string): Promise<ArrayBuffer> {
  let pending = cache.get(file);
  if (!pending) {
    pending = readFile(path.join(process.cwd(), 'src/app/fonts/og', file))
      .then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    pending.catch(() => cache.delete(file));
    cache.set(file, pending);
  }
  return pending;
}

/** Headings render at 600 in the heading family; body text has 400 and 600 in the body family. */
export async function brandImageFonts(preset: FontPreset): Promise<{ heading: string; body: string; fonts: OgFont[] }> {
  const headingFamily = OG_FONT_FILES[HEADING_FAMILY[preset]];
  const bodyFamily = OG_FONT_FILES[BODY_FAMILY[preset]];
  const faces = new Map<string, { name: string; file: string; weight: OgWeight }>();
  for (const face of [
    { name: headingFamily.name, file: headingFamily.files[600], weight: 600 as const },
    { name: bodyFamily.name, file: bodyFamily.files[400], weight: 400 as const },
    { name: bodyFamily.name, file: bodyFamily.files[600], weight: 600 as const },
  ]) {
    faces.set(face.file, face);
  }
  const fonts = await Promise.all(
    Array.from(faces.values(), async ({ name, file, weight }) => ({ name, data: await loadFile(file), weight, style: 'normal' as const })),
  );
  return { heading: headingFamily.name, body: bodyFamily.name, fonts };
}
