import { readFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { heicBufferToJpeg, isMissingHevcDecoderError } from '@/lib/heic-decode';

describe('heic-decode', () => {
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
});
