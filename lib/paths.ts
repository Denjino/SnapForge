import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

function resolveUserDataDir(): string {
  const fromEnv = process.env.USER_DATA_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  return path.join(os.tmpdir(), 'snapforge-dev');
}

export const USER_DATA_DIR = resolveUserDataDir();
export const IMAGE_ROOT_DIR = path.join(USER_DATA_DIR, 'image-processor');
export const IMAGE_UPLOADS_DIR = path.join(IMAGE_ROOT_DIR, 'uploads');
export const IMAGE_PROCESSED_DIR = path.join(IMAGE_ROOT_DIR, 'processed');

let ensured: Promise<void> | null = null;

export function ensureImageDirs(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    await fs.mkdir(IMAGE_UPLOADS_DIR, { recursive: true });
    await fs.mkdir(IMAGE_PROCESSED_DIR, { recursive: true });
  })();
  return ensured;
}
