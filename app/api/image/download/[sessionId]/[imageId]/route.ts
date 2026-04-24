import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import {
  extensionForFormat,
  mimeForFormat,
  type ImageFormat,
} from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string; imageId: string } }
) {
  const session = imageSessions.get(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  const data = session.get(params.imageId);
  if (!data) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const format: ImageFormat = data.currentFormat || 'avif';
  const ext = extensionForFormat(format);
  const baseName = path.parse(data.originalName).name;
  const downloadName = `${baseName}.${ext}`;

  // Copy into a fresh ArrayBuffer so the Response gets a stable, non-shared buffer.
  const bytes = new Uint8Array(data.currentBuffer);
  const body = new Blob([bytes], { type: mimeForFormat(format) });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': mimeForFormat(format),
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length': String(data.currentBuffer.length),
    },
  });
}
