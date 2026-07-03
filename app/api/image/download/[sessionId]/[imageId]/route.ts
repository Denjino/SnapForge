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

// Content-Disposition values must be header-safe: strip quotes/control chars
// and non-latin1 characters (which would throw when setting the header), and
// provide an RFC 5987 filename* for the original unicode name.
function contentDisposition(filename: string): string {
  const fallback =
    filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string; imageId: string } }
) {
  try {
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

    return new Response(new Uint8Array(data.currentBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeForFormat(format),
        'Content-Disposition': contentDisposition(downloadName),
        'Content-Length': String(data.currentBuffer.length),
      },
    });
  } catch (error) {
    console.error('[download] failed:', error);
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
