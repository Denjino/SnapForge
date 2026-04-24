import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';
import { extensionForFormat } from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = imageSessions.get(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  session.forEach((data) => {
    const baseName = path.parse(data.originalName).name;
    const ext = extensionForFormat(data.currentFormat || 'avif');
    archive.append(data.currentBuffer, { name: `${baseName}.${ext}` });
  });
  archive.finalize();

  // Convert node stream to web ReadableStream so Next's Response can stream it.
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="processed-images.zip"',
    },
  });
}
