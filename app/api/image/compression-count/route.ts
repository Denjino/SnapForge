import { NextRequest, NextResponse } from 'next/server';
import { getCompressionCount } from '@/lib/tinypng';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-tinypng-key') || '';
  if (!apiKey.trim()) {
    return NextResponse.json(
      { compressionCount: null, monthlyLimit: 500, error: 'TinyPNG API key required' },
      { status: 400 }
    );
  }
  try {
    const compressionCount = await getCompressionCount(apiKey);
    return NextResponse.json({ compressionCount, monthlyLimit: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json(
      { compressionCount: null, monthlyLimit: 500, error: message },
      { status: 500 }
    );
  }
}
