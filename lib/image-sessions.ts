import type { ImageFormat } from './sharp-utils';

export type Stage = 'uploaded' | 'converted' | 'resized' | 'compressed';

export interface ImageSessionData {
  id: string;
  originalName: string;
  originalFormat: ImageFormat;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  currentBuffer: Buffer;
  currentSize: number;
  currentWidth: number;
  currentHeight: number;
  currentFormat: ImageFormat;
  filename: string;
  filepath: string;
  stage: Stage;
  keptOriginal?: boolean;
  convertedWouldBe?: number;
  targetFormat?: 'avif' | 'webp';
}

// Module-level Map. Persists across API calls because Next.js's standalone
// server runs in a single long-lived Node process (under Electron). Not
// persisted across app restarts — matches the original Express behavior.
//
// Key: sessionId. Value: Map<imageId, ImageSessionData>.
type Sessions = Map<string, Map<string, ImageSessionData>>;

const globalAny = globalThis as typeof globalThis & {
  __snapforgeImageSessions?: Sessions;
};

if (!globalAny.__snapforgeImageSessions) {
  globalAny.__snapforgeImageSessions = new Map();
}

export const imageSessions: Sessions = globalAny.__snapforgeImageSessions;
