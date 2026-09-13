import path from 'node:path';

import { NextResponse } from 'next/server';

import { readObject } from '@/lib/storage';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;

  if (segments.some((segment) => segment === '..' || segment.includes('\0'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const key = segments.join('/');

  try {
    const data = await readObject(key);
    const ext = path.extname(key).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': contentType } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
