import { readFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { decodeNonSharpRaster, heicBufferToJpeg, isMissingHevcDecoderError } from '@/lib/heic-decode';
import { buildImageVariants } from '@/lib/image-variants';

function make24BitBmp(width: number, height: number, r: number, g: number, b: number): Buffer {
  const rowStride = Math.floor((24 * width + 31) / 32) * 4;
  const pixelBytes = rowStride * height;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = 54 + y * rowStride + x * 3;
      buf[p] = b;
      buf[p + 1] = g;
      buf[p + 2] = r;
    }
  }
  return buf;
}

function makePngIco(png: Buffer, width: number, height: number): Buffer {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

describe('heic-decode & non-sharp raster fallbacks', () => {
  it('detects missing HEVC decoder errors from sharp', () => {
    expect(isMissingHevcDecoderError(new Error('heif: Support for this compression format has not been built in: HEVC (libde265)'))).toBe(true);
    expect(isMissingHevcDecoderError(new Error('Image is too large'))).toBe(false);
  });

  it('converts HEVC HEIC into a JPEG sharp can process', async () => {
    const heic = readFileSync(join(__dirname, '../fixtures/sample.heic'));
    await expect(sharp(heic).jpeg().toBuffer()).rejects.toThrow(/HEVC|libde265|compression format/i);

    const jpeg = await heicBufferToJpeg(heic);
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  it('decodes 24-bit BMP and PNG-wrapped ICO buffers, rejecting corrupt data', async () => {
    const bmp = make24BitBmp(4, 3, 200, 100, 50);
    const decodedBmp = decodeNonSharpRaster(bmp);
    expect(decodedBmp).not.toBeNull();
    expect(decodedBmp?.kind).toBe('rgba');
    if (decodedBmp?.kind === 'rgba') {
      expect(decodedBmp.width).toBe(4);
      expect(decodedBmp.height).toBe(3);
      expect([decodedBmp.data[0], decodedBmp.data[1], decodedBmp.data[2], decodedBmp.data[3]]).toEqual([200, 100, 50, 255]);
    }

    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 20, g: 120, b: 220, alpha: 1 } } }).png().toBuffer();
    const ico = makePngIco(png, 16, 16);
    const decodedIco = decodeNonSharpRaster(ico);
    expect(decodedIco?.kind).toBe('encoded');

    expect(decodeNonSharpRaster(Buffer.from('not an image'))).toBeNull();
  });

  it('emits only a first-frame thumb WebP poster for GIFs so cards/details stay animated while thumbs stay light', async () => {
    const gif = await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    }).gif().toBuffer();
    const variants = await buildImageVariants(gif, 'sample.gif');
    expect(variants).toHaveLength(1);
    expect(variants.map((v) => v.filename)).toEqual(['sample-thumb.webp']);
    expect(variants[0].contentType).toBe('image/webp');
    expect(variants[0].buffer.length).toBeGreaterThan(0);
  });
});
