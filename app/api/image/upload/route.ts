import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  extensionForFormat,
  getImageInfo,
  type ImageFormat,
} from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';
import { ensureImageDirs, IMAGE_PROCESSED_DIR } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/avif',
]);
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await ensureImageDirs();

    const formData = await req.formData();
    const files = formData.getAll('images');
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const sessionId = uuidv4();
    const results = [];
    const sessionMap = new Map();

    for (const entry of files) {
      if (!(entry instanceof File)) continue;
      if (entry.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `${entry.name} exceeds 50MB limit` },
          { status: 413 }
        );
      }
      if (entry.type && !ALLOWED.has(entry.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type for ${entry.name}. Only PNG, JPEG, WebP, and AVIF are allowed.`,
          },
          { status: 415 }
        );
      }

      const buffer = Buffer.from(await entry.arrayBuffer());
      const info = await getImageInfo(buffer);

      const imageId = uuidv4();
      const ext = extensionForFormat(info.format);
      const filename = `${imageId}.${ext}`;
      const filepath = path.join(IMAGE_PROCESSED_DIR, filename);
      await fs.writeFile(filepath, buffer);

      const data = {
        id: imageId,
        originalName: entry.name,
        originalFormat: info.format as ImageFormat,
        originalSize: buffer.length,
        originalWidth: info.width,
        originalHeight: info.height,
        currentBuffer: buffer,
        currentSize: buffer.length,
        currentWidth: info.width,
        currentHeight: info.height,
        currentFormat: info.format as ImageFormat,
        filename,
        filepath,
        stage: 'uploaded' as const,
      };
      sessionMap.set(imageId, data);

      results.push({
        id: imageId,
        originalName: entry.name,
        originalFormat: info.format,
        originalSize: buffer.length,
        originalWidth: info.width,
        originalHeight: info.height,
        currentSize: buffer.length,
        currentWidth: info.width,
        currentHeight: info.height,
        currentFormat: info.format,
        filename,
        stage: 'uploaded',
      });
    }

    imageSessions.set(sessionId, sessionMap);
    return NextResponse.json({ sessionId, images: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
