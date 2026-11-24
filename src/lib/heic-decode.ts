import convert from 'heic-convert';

const MAX_DECODE_DIMENSION = 16384;
const MAX_DECODE_PIXELS = 64_000_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type DecodedRasterFallback =
  | { kind: 'rgba'; data: Buffer; width: number; height: number; hasAlpha: boolean }
  | { kind: 'encoded'; buffer: Buffer };

/**
 * Prebuilt sharp/libvips binaries cannot decode HEVC-based HEIC (patent-encumbered).
 * Convert to JPEG first so the rest of the upload pipeline can use sharp normally.
 */
export async function heicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  // libheif-js WASM rejects Node Buffer objects in some runtimes; pass a plain Uint8Array.
  const input = Uint8Array.from(buffer);
  const output = await convert({
    buffer: input,
    format: 'JPEG',
    quality: 0.92,
  });
  return Buffer.from(output);
}

export function isMissingHevcDecoderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /libde265|compression format has not been built in|HEVC/i.test(message);
}

function bitMaskShiftAndScale(mask: number): { shift: number; max: number } {
  if (mask === 0) return { shift: 0, max: 1 };
  let shift = 0;
  let m = mask >>> 0;
  while ((m & 1) === 0 && shift < 32) {
    m >>>= 1;
    shift += 1;
  }
  return { shift, max: m || 1 };
}

/**
 * Decode a DIB (BITMAPINFOHEADER + optional palette + pixel data + optional ICO AND mask) into RGBA.
 * Handles 32/24/16/8/4/1-bit BI_RGB and 16/32-bit BI_BITFIELDS bitmaps.
 */
function decodeDibToRgba(
  dib: Buffer,
  options: { pixelOffset?: number; isIcoEntry?: boolean } = {},
): DecodedRasterFallback | null {
  if (dib.length < 40) return null;
  const headerSize = dib.readUInt32LE(0);
  if (headerSize < 40 || headerSize > dib.length) return null;

  const width = dib.readInt32LE(4);
  const rawHeight = dib.readInt32LE(8);
  const planes = dib.readUInt16LE(12);
  const bitCount = dib.readUInt16LE(14);
  const compression = dib.readUInt32LE(16);
  const colorsUsed = dib.readUInt32LE(32);

  if (planes !== 1) return null;
  if (compression !== 0 && compression !== 3) return null;

  const isTopDown = rawHeight < 0;
  const height = options.isIcoEntry ? Math.floor(Math.abs(rawHeight) / 2) : Math.abs(rawHeight);
  if (
    width <= 0
    || height <= 0
    || width > MAX_DECODE_DIMENSION
    || height > MAX_DECODE_DIMENSION
    || width * height > MAX_DECODE_PIXELS
  ) {
    return null;
  }
  if (![1, 4, 8, 16, 24, 32].includes(bitCount)) return null;

  let rMask = 0x00ff0000;
  let gMask = 0x0000ff00;
  let bMask = 0x000000ff;
  let aMask = bitCount === 32 ? 0xff000000 : 0;
  let paletteOffset = headerSize;

  if (compression === 3) {
    if (headerSize >= 56) {
      rMask = dib.readUInt32LE(40);
      gMask = dib.readUInt32LE(44);
      bMask = dib.readUInt32LE(48);
      aMask = dib.readUInt32LE(52);
    } else if (dib.length >= headerSize + 12) {
      rMask = dib.readUInt32LE(headerSize);
      gMask = dib.readUInt32LE(headerSize + 4);
      bMask = dib.readUInt32LE(headerSize + 8);
      aMask = 0;
      paletteOffset = headerSize + 12;
    }
  }

  const paletteEntries = bitCount <= 8 ? (colorsUsed > 0 ? colorsUsed : 1 << bitCount) : 0;
  const paletteBytes = paletteEntries * 4;
  if (paletteOffset + paletteBytes > dib.length) return null;

  const pixelOffset = options.pixelOffset ?? (paletteOffset + paletteBytes);
  const rowStride = Math.floor((bitCount * width + 31) / 32) * 4;
  const xorSize = rowStride * height;
  if (pixelOffset < 0 || pixelOffset + xorSize > dib.length) return null;

  const rgba = Buffer.alloc(width * height * 4);
  const rShift = bitMaskShiftAndScale(rMask);
  const gShift = bitMaskShiftAndScale(gMask);
  const bShift = bitMaskShiftAndScale(bMask);
  const aShift = bitMaskShiftAndScale(aMask);
  let sawNonOpaqueAlpha = false;
  let sawAnyNonZeroAlpha = false;

  for (let y = 0; y < height; y += 1) {
    const srcRow = isTopDown ? y : height - 1 - y;
    const rowStart = pixelOffset + srcRow * rowStride;
    for (let x = 0; x < width; x += 1) {
      const dst = (y * width + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;

      if (bitCount === 32) {
        if (compression === 3) {
          const v = dib.readUInt32LE(rowStart + x * 4);
          r = Math.round((((v & rMask) >>> rShift.shift) * 255) / rShift.max);
          g = Math.round((((v & gMask) >>> gShift.shift) * 255) / gShift.max);
          b = Math.round((((v & bMask) >>> bShift.shift) * 255) / bShift.max);
          a = aMask ? Math.round((((v & aMask) >>> aShift.shift) * 255) / aShift.max) : 255;
        } else {
          b = dib[rowStart + x * 4];
          g = dib[rowStart + x * 4 + 1];
          r = dib[rowStart + x * 4 + 2];
          a = dib[rowStart + x * 4 + 3];
        }
        if (a > 0) sawAnyNonZeroAlpha = true;
        if (a < 255) sawNonOpaqueAlpha = true;
      } else if (bitCount === 24) {
        b = dib[rowStart + x * 3];
        g = dib[rowStart + x * 3 + 1];
        r = dib[rowStart + x * 3 + 2];
      } else if (bitCount === 16) {
        const v = dib.readUInt16LE(rowStart + x * 2);
        if (compression === 3) {
          r = Math.round((((v & rMask) >>> rShift.shift) * 255) / rShift.max);
          g = Math.round((((v & gMask) >>> gShift.shift) * 255) / gShift.max);
          b = Math.round((((v & bMask) >>> bShift.shift) * 255) / bShift.max);
          a = aMask ? Math.round((((v & aMask) >>> aShift.shift) * 255) / aShift.max) : 255;
        } else {
          r = Math.round((((v >> 10) & 0x1f) * 255) / 31);
          g = Math.round((((v >> 5) & 0x1f) * 255) / 31);
          b = Math.round(((v & 0x1f) * 255) / 31);
        }
      } else {
        let idx = 0;
        if (bitCount === 8) {
          idx = dib[rowStart + x];
        } else if (bitCount === 4) {
          const byte = dib[rowStart + (x >> 1)];
          idx = (x & 1) === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
        } else {
          const byte = dib[rowStart + (x >> 3)];
          idx = (byte >> (7 - (x & 7))) & 1;
        }
        if (idx < paletteEntries) {
          const p = paletteOffset + idx * 4;
          b = dib[p];
          g = dib[p + 1];
          r = dib[p + 2];
        }
      }

      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = a;
    }
  }

  // Classic 32-bit BI_RGB BMPs leave the alpha byte zeroed (unused XRGB) — treat as opaque.
  if (bitCount === 32 && !sawAnyNonZeroAlpha) {
    for (let i = 3; i < rgba.length; i += 4) {
      rgba[i] = 255;
    }
    sawNonOpaqueAlpha = false;
  }

  // Apply the 1-bit AND transparency mask for classic DIB-encoded ICO entries without an alpha channel.
  if (options.isIcoEntry && (!sawAnyNonZeroAlpha || bitCount < 32)) {
    const maskStride = Math.floor((width + 31) / 32) * 4;
    const maskStart = pixelOffset + xorSize;
    if (maskStart + maskStride * height <= dib.length) {
      for (let y = 0; y < height; y += 1) {
        const srcRow = isTopDown ? y : height - 1 - y;
        const rowStart = maskStart + srcRow * maskStride;
        for (let x = 0; x < width; x += 1) {
          const maskBit = (dib[rowStart + (x >> 3)] >> (7 - (x & 7))) & 1;
          if (maskBit === 1) {
            rgba[(y * width + x) * 4 + 3] = 0;
            sawNonOpaqueAlpha = true;
          }
        }
      }
    }
  }

  return { kind: 'rgba', data: rgba, width, height, hasAlpha: sawNonOpaqueAlpha };
}

/** Decode Windows BMP ("BM") or ICO/CUR buffers that libvips/sharp does not decode natively. */
export function decodeNonSharpRaster(buffer: Buffer): DecodedRasterFallback | null {
  if (buffer.length >= 54 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    const pixelOffset = buffer.readUInt32LE(10);
    if (pixelOffset < 14 || pixelOffset >= buffer.length) return null;
    return decodeDibToRgba(buffer.subarray(14), { pixelOffset: pixelOffset - 14 });
  }

  // ICO (type 1) or CUR (type 2): pick the largest embedded icon entry.
  if (buffer.length >= 22 && buffer.readUInt16LE(0) === 0) {
    const iconType = buffer.readUInt16LE(2);
    const count = buffer.readUInt16LE(4);
    if ((iconType === 1 || iconType === 2) && count >= 1 && buffer.length >= 6 + count * 16) {
      let best: { offset: number; size: number; score: number } | null = null;
      for (let i = 0; i < count; i += 1) {
        const entry = 6 + i * 16;
        const width = buffer[entry] || 256;
        const height = buffer[entry + 1] || 256;
        const bitCount = buffer.readUInt16LE(entry + 6);
        const size = buffer.readUInt32LE(entry + 8);
        const offset = buffer.readUInt32LE(entry + 12);
        if (size === 0 || offset + size > buffer.length) continue;
        const score = width * height * 64 + bitCount;
        if (!best || score > best.score) {
          best = { offset, size, score };
        }
      }
      if (!best) return null;
      const payload = buffer.subarray(best.offset, best.offset + best.size);
      if (payload.length >= 8 && payload.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return { kind: 'encoded', buffer: payload };
      }
      return decodeDibToRgba(payload, { isIcoEntry: true });
    }
  }

  return null;
}
