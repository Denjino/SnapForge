import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  extensionForFormat,
  getImageInfo,
  type ImageFormat,
} from '@/lib/sharp-utils';
import { compressBuffer } from '@/lib/tinypng';
import { imageSessions } from '@/lib/image-sessions';
import { ensureImageDirs, IMAGE_PROCESSED_DIR } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureImageDirs();

    // Key arrives via header so it stays out of the JSON body (which might get
    // logged / cached upstream). We never echo it back in responses or errors.
    const apiKey = req.headers.get('x-tinypng-key') || '';
    if (!apiKey.trim()) {
      return NextResponse.json(
        { error: 'TinyPNG API key required. Add one in Settings.', code: 'TINYPNG_KEY_MISSING' },
        { status: 400 }
      );
    }

    const { sessionId, imageIds } = (await req.json()) as {
      sessionId: string;
      imageIds: string[];
    };

    const session = imageSessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const results = [];
    let compressionCount: number | null = null;

    for (const imageId of imageIds) {
      const data = session.get(imageId);
      if (!data) continue;

      const outputFormat: ImageFormat = data.currentFormat || 'png';
      const { buffer: compressed, compressionCount: cc } = await compressBuffer(
        data.currentBuffer,
        apiKey,
        outputFormat
      );
      if (cc !== null) compressionCount = cc;

      const info = await getImageInfo(compressed);

      const ext = extensionForFormat(outputFormat);
      const newFilename = `${imageId}.${ext}`;
      const newFilepath = path.join(IMAGE_PROCESSED_DIR, newFilename);
      if (data.filepath !== newFilepath) {
        try {
          await fs.unlink(data.filepath);
        } catch {
          // ignore
        }
      }
      await fs.writeFile(newFilepath, compressed);

      data.currentBuffer = compressed;
      data.currentSize = compressed.length;
      data.currentFormat = outputFormat;
      data.filename = newFilename;
      data.filepath = newFilepath;
      data.stage = 'compressed';

      results.push({
        id: imageId,
        originalName: data.originalName,
        compressedSize: compressed.length,
        compressedWidth: info.width,
        compressedHeight: info.height,
        stage: 'compressed',
      });
    }

    return NextResponse.json({ images: results, compressionCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compression failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
