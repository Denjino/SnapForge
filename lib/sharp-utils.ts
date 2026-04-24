import sharp from 'sharp';

export type ImageFormat = 'avif' | 'webp' | 'png' | 'jpeg' | 'jpg';

export interface ImageInfo {
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
}

export async function getImageInfo(buffer: Buffer): Promise<ImageInfo> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: (metadata.format as ImageFormat) ?? 'png',
    size: buffer.length,
  };
}

export function extensionForFormat(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

export function mimeForFormat(format: ImageFormat): string {
  switch (format) {
    case 'avif':
      return 'image/avif';
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

// Convert a buffer to the target format. Returns the converted buffer regardless
// of whether it's smaller — the caller decides whether to keep it.
export async function convertBuffer(
  buffer: Buffer,
  target: 'avif' | 'webp'
): Promise<Buffer> {
  if (target === 'avif') {
    return sharp(buffer)
      .avif({ quality: 80, effort: 6, chromaSubsampling: '4:4:4' })
      .toBuffer();
  }
  return sharp(buffer).webp({ quality: 80, effort: 6 }).toBuffer();
}

// Resize preserving the current format. Downscale-only (skipped === true if the
// image is already smaller than the target along its longest side).
export async function resizeBuffer(
  buffer: Buffer,
  currentFormat: ImageFormat,
  currentWidth: number,
  currentHeight: number,
  targetLongSide: number
): Promise<{ buffer: Buffer; skipped: boolean }> {
  const longSide = Math.max(currentWidth, currentHeight);
  if (longSide <= targetLongSide) {
    return { buffer, skipped: true };
  }
  const ratio = targetLongSide / longSide;
  const width = Math.round(currentWidth * ratio);
  const height = Math.round(currentHeight * ratio);

  let instance = sharp(buffer).resize(width, height, { fit: 'inside' });
  switch (currentFormat) {
    case 'avif':
      instance = instance.avif({ quality: 80, effort: 6, chromaSubsampling: '4:4:4' });
      break;
    case 'webp':
      instance = instance.webp({ quality: 80 });
      break;
    case 'png':
      instance = instance.png({ quality: 80 });
      break;
    case 'jpeg':
    case 'jpg':
      instance = instance.jpeg({ quality: 80 });
      break;
    default:
      instance = instance.avif({ quality: 80, effort: 6, chromaSubsampling: '4:4:4' });
  }
  const out = await instance.toBuffer();
  return { buffer: out, skipped: false };
}

export const RESIZE_PRESETS: Record<string, number> = {
  '1k': 1000,
  '1.5k': 1500,
  '2k': 2000,
  '3k': 3000,
};
