import sharp from 'sharp';

type VariantSpec = {
  suffix: string;
  maxWidth: number;
  quality: number;
};

const VARIANTS: VariantSpec[] = [
  { suffix: 'thumb', maxWidth: 400, quality: 80 },
  { suffix: 'md', maxWidth: 800, quality: 82 },
  { suffix: 'lg', maxWidth: 1600, quality: 85 },
];

export type GeneratedImageVariant = {
  suffix: string;
  filename: string;
  buffer: Buffer;
  contentType: string;
};

function splitFilename(filename: string): { stem: string; ext: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) {
    return { stem: filename, ext: 'jpg' };
  }
  return { stem: filename.slice(0, dot), ext: filename.slice(dot + 1) };
}

export async function buildImageVariants(buffer: Buffer, filename: string): Promise<GeneratedImageVariant[]> {
  const { stem } = splitFilename(filename);
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width) {
    return [];
  }

  const variants: GeneratedImageVariant[] = [];

  for (const variant of VARIANTS) {
    if (metadata.width <= variant.maxWidth && variant.suffix !== 'thumb') {
      continue;
    }

    const outBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: variant.maxWidth, withoutEnlargement: true })
      .webp({ quality: variant.quality })
      .toBuffer();

    variants.push({
      suffix: variant.suffix,
      filename: `${stem}-${variant.suffix}.webp`,
      buffer: outBuffer,
      contentType: 'image/webp',
    });
  }

  return variants;
}
