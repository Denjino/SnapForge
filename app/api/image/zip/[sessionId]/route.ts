import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import archiver from 'archiver';
import { extensionForFormat } from '@/lib/sharp-utils';
import { imageSessions } from '@/lib/image-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Collect the archive into a single Buffer instead of streaming. Sessions
// already hold every image buffer in memory, so this doesn't change the
// memory profile — and it avoids Readable.toWeb on archiver's userland
// stream, plus lets us return a JSON error if anything throws.
function buildZipBuffer(
  entries: Array<{ name: string; buffer: Buffer }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('warning', (err) => {
      // Non-fatal warnings (e.g. stat failures) — we only append buffers,
      // so treat anything here as fatal to avoid silently truncated zips.
      reject(err);
    });
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name });
    }
    archive.finalize().catch(reject);
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = imageSessions.get(params.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const entries: Array<{ name: string; buffer: Buffer }> = [];
    session.forEach((data) => {
      const baseName = path.parse(data.originalName).name;
      const ext = extensionForFormat(data.currentFormat || 'avif');
      entries.push({ name: `${baseName}.${ext}`, buffer: data.currentBuffer });
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Session has no images' }, { status: 404 });
    }

    const zip = await buildZipBuffer(entries);

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="processed-images.zip"',
        'Content-Length': String(zip.length),
      },
    });
  } catch (error) {
    console.error('[zip] failed:', error);
    const message = error instanceof Error ? error.message : 'Zip failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
