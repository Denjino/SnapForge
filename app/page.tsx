'use client';

import { useEffect, useState } from 'react';
import { Camera, ImagePlus, Sparkles } from 'lucide-react';
import { ToolCard } from '@/components/hub/ToolCard';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import { getSetting, isElectron } from '@/lib/settings-client';

export default function HubPage() {
  const [compressionCount, setCompressionCount] = useState<number | null>(null);
  const [keyConfigured, setKeyConfigured] = useState<boolean>(false);
  const [electron, setElectron] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${APP_NAME} — ${APP_TAGLINE}`;
    setElectron(isElectron());
  }, []);

  // Only fetch the compression count when a key is actually configured —
  // each lookup costs a TinyPNG credit, so don't nag first-run users.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await getSetting('tinypngApiKey');
      if (cancelled) return;
      if (!key) {
        setKeyConfigured(false);
        return;
      }
      setKeyConfigured(true);
      try {
        const res = await fetch('/api/image/compression-count', {
          headers: { 'X-TinyPNG-Key': key },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCompressionCount(data.compressionCount ?? null);
      } catch {
        // ignore — just a status indicator
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-surface-0">
      <div className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.22em] text-muted font-medium mb-2">
            {APP_TAGLINE}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
            {APP_NAME} — {APP_TAGLINE}
          </h1>
          <p className="text-muted mt-3 max-w-xl leading-relaxed">
            A small collection of desktop tools that run entirely on your machine.
            No cloud, no accounts — pick a tool below to get started.
          </p>
        </div>

        {/* Tool cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ToolCard
            href="/screenshot"
            accent="emerald"
            icon={<Camera size={20} />}
            title="Screenshot Capture"
            description="Bulk capture URLs at any viewport. Full-page support, cookie banners auto-dismissed, download individually or as a zip."
            meta="Playwright · Chromium"
          />
          <ToolCard
            href="/image-processor"
            accent="cyan"
            icon={<ImagePlus size={20} />}
            title="Image Processor"
            description="Convert to AVIF/WebP, downscale to 1K–3K, and optionally compress with TinyPNG. Keeps the smaller of each pair."
            meta="Sharp · TinyPNG"
          />
          <ToolCard
            href="#"
            icon={<Sparkles size={20} />}
            title="More tools soon"
            description="New tools are added over time. Have a request? Open an issue on GitHub."
            status="coming-soon"
          />
        </div>

        {/* Status row */}
        <div className="mt-10 flex items-center justify-between text-xs text-muted border-t border-border pt-5">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Screenshot ready
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  keyConfigured ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
              />
              {keyConfigured
                ? compressionCount !== null
                  ? `TinyPNG · ${compressionCount} / 500 this month`
                  : 'TinyPNG key configured'
                : 'TinyPNG key not set'}
            </span>
          </div>
          <span
            className="font-mono text-[11px] text-muted/70"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {electron ? 'desktop' : 'web'}
          </span>
        </div>
      </div>
    </main>
  );
}
