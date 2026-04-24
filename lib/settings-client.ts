// Client helpers for reading/writing persistent settings from within the
// browser (Next.js renderer running inside the Electron window).
//
// - In Electron, window.api.settings is exposed by electron/preload.js.
// - In a plain `next dev` session, window.api is undefined, so we fall back
//   to NEXT_PUBLIC_DEV_TINYPNG_KEY so the image processor can be exercised
//   end-to-end outside Electron. Never ship a dev key.

const DEV_FALLBACK_KEYS: Record<string, string> = {
  tinypngApiKey: process.env.NEXT_PUBLIC_DEV_TINYPNG_KEY ?? '',
};

export async function getSetting(key: string): Promise<string> {
  if (typeof window !== 'undefined' && window.api?.settings) {
    const value = await window.api.settings.get(key);
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  }
  return DEV_FALLBACK_KEYS[key] ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.api?.settings) {
    await window.api.settings.set(key, value);
    return;
  }
  // No-op in pure web dev — the dev fallback is read-only.
}

export async function hasSetting(key: string): Promise<boolean> {
  if (typeof window !== 'undefined' && window.api?.settings) {
    return window.api.settings.has(key);
  }
  return (DEV_FALLBACK_KEYS[key] ?? '').length > 0;
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.api;
}
