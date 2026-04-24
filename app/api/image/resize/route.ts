import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import {
  getImageInfo,
  RESIZE_PRESETS,
  resizeBuffer,
} from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';
import { ensureImageDirs } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureImageDirs();

    const { sessionId, imageIds, preset } = (await req.json()) as {
      sessionId: string;
      imageIds: string[];
      preset: string;
    };

    const targetSize = RESIZE_PRESETS[preset];
    if (!targetSize) {
      return NextResponse.json({ error: 'Invalid preset' }, { status: 400 });
    }

    const session = imageSessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const results = [];

    for (const imageId of imageIds) {
      const data = session.get(imageId);
      if (!data) continue;

      const { buffer: resized, skipped } = await resizeBuffer(
        data.currentBuffer,
        data.currentFormat,
        data.currentWidth,
        data.currentHeight,
        targetSize
      );
      const resizedInfo = await getImageInfo(resized);

      await fs.writeFile(data.filepath, resized);

      data.currentBuffer = resized;
      data.currentSize = resized.length;
      data.currentWidth = resizedInfo.width;
      data.currentHeight = resizedInfo.height;
      data.stage = 'resized';

      results.push({
        id: imageId,
        originalName: data.originalName,
        resizedWidth: resizedInfo.width,
        resizedHeight: resizedInfo.height,
        resizedSize: resized.length,
        skipped,
        stage: 'resized',
      });
    }

    return NextResponse.json({ images: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resize failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
