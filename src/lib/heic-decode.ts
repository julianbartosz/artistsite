import convert from 'heic-convert';

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
