import { mimeForFormat, type ImageFormat } from './sharp-utils';

const TINIFY_SHRINK = 'https://api.tinify.com/shrink';

function authHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from('api:' + apiKey).toString('base64');
}

export interface CompressResult {
  buffer: Buffer;
  compressionCount: number | null;
}

export async function compressBuffer(
  buffer: Buffer,
  apiKey: string,
  outputFormat: ImageFormat
): Promise<CompressResult> {
  if (!apiKey) {
    throw new Error('TinyPNG API key is required');
  }

  const shrink = await fetch(TINIFY_SHRINK, {
    method: 'POST',
    headers: { Authorization: authHeader(apiKey) },
    body: new Uint8Array(buffer),
  });

  if (!shrink.ok) {
    let message = 'TinyPNG rejected the upload';
    try {
      const errBody = (await shrink.json()) as { message?: string };
      if (errBody && errBody.message) message = `TinyPNG: ${errBody.message}`;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const compressionCountHeader = shrink.headers.get('Compression-Count');
  const compressionCount = compressionCountHeader ? parseInt(compressionCountHeader, 10) : null;

  const location = shrink.headers.get('Location');
  if (!location) {
    throw new Error('TinyPNG did not return a result location');
  }

  const outputMime = mimeForFormat(outputFormat);
  const download = await fetch(location, {
    method: 'POST',
    headers: {
      Authorization: authHeader(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ convert: { type: outputMime } }),
  });

  if (!download.ok) {
    throw new Error('Failed to download compressed image from TinyPNG');
  }

  const compressed = Buffer.from(await download.arrayBuffer());
  return { buffer: compressed, compressionCount };
}

// Fetch just the running monthly count without processing a user image.
// Uses a 1x1 transparent PNG — TinyPNG bills for this (~1 credit), so only call
// this when the UI actually needs a fresh number (e.g. settings page save).
const TINY_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function getCompressionCount(apiKey: string): Promise<number | null> {
  if (!apiKey) return null;
  const res = await fetch(TINIFY_SHRINK, {
    method: 'POST',
    headers: { Authorization: authHeader(apiKey) },
    body: new Uint8Array(TINY_PIXEL),
  });
  const header = res.headers.get('Compression-Count');
  if (!header) return null;
  const n = parseInt(header, 10);
  return Number.isFinite(n) ? n : null;
}
