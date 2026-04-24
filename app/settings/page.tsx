'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ExternalLink, Check } from 'lucide-react';
import { getSetting, isElectron, setSetting } from '@/lib/settings-client';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [compressionCount, setCompressionCount] = useState<number | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [electron, setElectron] = useState<boolean>(false);

  useEffect(() => {
    document.title = 'Settings';
    setElectron(isElectron());
    (async () => {
      const v = await getSetting('tinypngApiKey');
      if (v) setApiKey(v);
    })();
  }, []);

  const handleSave = async () => {
    await setSetting('tinypngApiKey', apiKey.trim());
    setSavedAt(Date.now());
    setCompressionCount(null);
    setCheckError(null);
    if (apiKey.trim()) {
      setChecking(true);
      try {
        const res = await fetch('/api/image/compression-count', {
          headers: { 'X-TinyPNG-Key': apiKey.trim() },
        });
        const data = await res.json();
        if (res.ok) {
          setCompressionCount(data.compressionCount ?? null);
        } else {
          setCheckError(data.error || 'Unable to verify key');
        }
      } catch (err) {
        setCheckError(err instanceof Error ? err.message : 'Unable to verify key');
      } finally {
        setChecking(false);
      }
    }
  };

  const justSaved = savedAt !== null && Date.now() - savedAt < 3000;

  return (
    <main className="min-h-screen bg-surface-0">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-medium mb-1">
            Preferences
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="text-muted mt-2 text-sm">
            Configure API keys and preferences for the tools in SnapForge. Stored
            locally on this machine.
          </p>
        </div>

        {!electron && (
          <div className="mb-6 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3 text-[13px] text-amber-200">
            You're viewing Settings in a browser (not the desktop app). Changes here
            won't persist unless you're running SnapForge as an Electron app.
          </div>
        )}

        <section className="bg-surface-1 border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">TinyPNG API key</h2>
              <p className="text-xs text-muted mt-1">
                Required for the Image Processor's compression step. Sent directly to
                tinypng.com — never logged or transmitted anywhere else.
              </p>
            </div>
          </div>

          <label htmlFor="tinypng-key" className="sr-only">
            TinyPNG API key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="tinypng-key"
                type={show ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your TinyPNG API key"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-surface-0 border border-border rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 pr-10"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide key' : 'Show key'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-white"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="bg-accent text-surface-0 px-5 py-2.5 rounded-lg text-sm font-medium hover:brightness-110 transition-all inline-flex items-center gap-2"
            >
              {justSaved ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs">
            <a
              href="https://tinify.com/dashboard/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              Get a free key at tinify.com <ExternalLink size={12} />
            </a>
            {checking && <span className="text-muted">Verifying…</span>}
            {!checking && compressionCount !== null && (
              <span
                className="text-muted font-mono"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {compressionCount} / 500 used this month
              </span>
            )}
            {!checking && checkError && (
              <span className="text-red-400">{checkError}</span>
            )}
          </div>
        </section>

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm text-muted hover:text-white">
            ← Back to hub
          </Link>
        </div>
      </div>
    </main>
  );
}
