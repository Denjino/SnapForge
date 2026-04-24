import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  convertBuffer,
  extensionForFormat,
  getImageInfo,
  type ImageFormat,
} from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';
import { ensureImageDirs, IMAGE_PROCESSED_DIR } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureImageDirs();

    const body = await req.json();
    const { sessionId, imageIds, format } = body as {
      sessionId: string;
      imageIds: string[];
      format: 'avif' | 'webp';
    };

    if (!['avif', 'webp'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "avif" or "webp".' },
        { status: 400 }
      );
    }

    const session = imageSessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const results = [];

    for (const imageId of imageIds) {
      const data = session.get(imageId);
      if (!data) continue;

      const convertedBuffer = await convertBuffer(data.currentBuffer, format);

      const convertedIsSmaller = convertedBuffer.length < data.currentSize;
      const finalBuffer = convertedIsSmaller ? convertedBuffer : data.currentBuffer;
      const finalFormat: ImageFormat = convertedIsSmaller ? format : data.currentFormat;
      const finalExt = extensionForFormat(finalFormat);

      const finalInfo = await getImageInfo(finalBuffer);

      const newFilename = `${imageId}.${finalExt}`;
      const newFilepath = path.join(IMAGE_PROCESSED_DIR, newFilename);

      if (data.filepath !== newFilepath) {
        try {
          await fs.unlink(data.filepath);
        } catch {
          // ignore
        }
      }
      await fs.writeFile(newFilepath, finalBuffer);

      data.currentBuffer = finalBuffer;
      data.currentSize = finalBuffer.length;
      data.currentWidth = finalInfo.width;
      data.currentHeight = finalInfo.height;
      data.currentFormat = finalFormat;
      data.filename = newFilename;
      data.filepath = newFilepath;
      data.stage = 'converted';
      data.keptOriginal = !convertedIsSmaller;
      data.convertedWouldBe = convertedBuffer.length;
      data.targetFormat = format;

      results.push({
        id: imageId,
        originalName: data.originalName,
        originalFormat: data.originalFormat,
        originalSize: data.originalSize,
        convertedSize: finalBuffer.length,
        convertedWidth: finalInfo.width,
        convertedHeight: finalInfo.height,
        convertedFormat: finalFormat,
        targetFormat: format,
        keptOriginal: !convertedIsSmaller,
        convertedWouldBe: convertedBuffer.length,
        stage: 'converted',
      });
    }

    return NextResponse.json({ images: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
