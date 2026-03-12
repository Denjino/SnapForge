'use client';

import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { VIEWPORT_PRESETS, VIEWPORT_CATEGORIES, type ViewportPreset } from '@/lib/viewports';

interface ScreenshotResult {
  url: string;
  image: string;
  viewport: ViewportPreset;
  timestamp: string;
  error?: string;
}

interface QueueItem {
  url: string;
  viewport: ViewportPreset;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: ScreenshotResult;
  error?: string;
}

export default function Home() {
  const [urlInput, setUrlInput] = useState('');
  const [selectedViewports, setSelectedViewports] = useState<string[]>(['desktop-1440']);
  const [fullPage, setFullPage] = useState(true);
  const [waitTime, setWaitTime] = useState(3);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ScreenshotResult[]>([]);
  const [customWidth, setCustomWidth] = useState(1440);
  const [customHeight, setCustomHeight] = useState(900);
  const [showCustom, setShowCustom] = useState(false);
  const abortRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && !u.startsWith('#'));
  };

  const toggleViewport = (id: string) => {
    setSelectedViewports((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setUrlInput((prev) => (prev ? prev + '\n' + text : text));
    };
    reader.readAsText(file);
  };

  const captureScreenshot = async (
    url: string,
    viewport: ViewportPreset
  ): Promise<ScreenshotResult> => {
    const res = await fetch('/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.isMobile,
        fullPage,
        waitTime: waitTime * 1000,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Screenshot failed');
    }

    return {
      url: data.url,
      image: data.image,
      viewport,
      timestamp: data.timestamp,
    };
  };

  const startCapture = async () => {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) return;

    const viewports = selectedViewports
      .map((id) => {
        if (id === 'custom') {
          return {
            id: 'custom',
            label: `Custom ${customWidth}×${customHeight}`,
            width: customWidth,
            height: customHeight,
            deviceScaleFactor: 1,
            isMobile: false,
            icon: '⚙',
            category: 'custom' as const,
          };
        }
        return VIEWPORT_PRESETS.find((p) => p.id === id);
      })
      .filter(Boolean) as ViewportPreset[];

    if (viewports.length === 0) return;

    // Build queue
    const newQueue: QueueItem[] = [];
    for (const url of urls) {
      for (const vp of viewports) {
        newQueue.push({ url, viewport: vp, status: 'pending' });
      }
    }

    setQueue(newQueue);
    setResults([]);
    setIsProcessing(true);
    abortRef.current = false;

    // Process queue sequentially
    for (let i = 0; i < newQueue.length; i++) {
      if (abortRef.current) break;

      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'processing' } : item
        )
      );

      try {
        const result = await captureScreenshot(
          newQueue[i].url,
          newQueue[i].viewport
        );
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', result } : item
          )
        );
        setResults((prev) => [...prev, result]);
      } catch (error: any) {
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'error', error: error.message }
              : item
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const stopCapture = () => {
    abortRef.current = true;
  };

  const downloadScreenshot = (result: ScreenshotResult) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${result.image}`;
    const hostname = new URL(result.url).hostname.replace(/\./g, '-');
    link.download = `${hostname}_${result.viewport.id}_${Date.now()}.png`;
    link.click();
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    for (const result of results) {
      const hostname = new URL(result.url).hostname.replace(/\./g, '-');
      const filename = `${hostname}_${result.viewport.id}.png`;
      zip.file(filename, result.image, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `snapforge_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const completedCount = queue.filter((q) => q.status === 'done').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;
  const totalCount = queue.length;
  const progress = totalCount > 0 ? (completedCount + errorCount) / totalCount : 0;

  return (
    <main className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="border-b border-border bg-surface-1/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              SnapForge
            </h1>
            <span className="text-xs text-muted font-mono bg-surface-3 px-2 py-0.5 rounded">
              v1.0
            </span>
          </div>
          {results.length > 0 && (
            <button
              onClick={downloadAll}
              className="text-sm bg-accent/10 text-accent hover:bg-accent/20 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Download All ({results.length})
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left: URL Input & Results */}
          <div className="space-y-6">
            {/* URL Input */}
            <section className="bg-surface-1 rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  URLs
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-muted hover:text-white bg-surface-3 hover:bg-surface-4 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Import .txt
                  </button>
                  <button
                    onClick={() => setUrlInput('')}
                    className="text-xs text-muted hover:text-white bg-surface-3 hover:bg-surface-4 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={`Paste URLs here, one per line...\n\nexample.com\nhttps://stripe.com\nlinear.app\nvercel.com`}
                rows={8}
                className="w-full bg-surface-0 border border-border rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-y"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted">
                  {parseUrls(urlInput).length} URL{parseUrls(urlInput).length !== 1 ? 's' : ''} detected
                </span>
                <span className="text-xs text-muted">
                  {parseUrls(urlInput).length * selectedViewports.length} total captures
                </span>
              </div>
            </section>

            {/* Progress */}
            {queue.length > 0 && (
              <section className="bg-surface-1 rounded-xl border border-border p-6 fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                    Progress
                  </h2>
                  <span className="text-xs font-mono text-muted">
                    {completedCount}/{totalCount} complete
                    {errorCount > 0 && (
                      <span className="text-red-400 ml-2">
                        {errorCount} failed
                      </span>
                    )}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300 progress-fill"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {/* Queue items */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {queue.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-xs py-1.5 px-3 rounded-md ${
                        item.status === 'processing'
                          ? 'bg-accent/5 text-accent'
                          : item.status === 'done'
                          ? 'text-gray-400'
                          : item.status === 'error'
                          ? 'text-red-400'
                          : 'text-gray-600'
                      }`}
                    >
                      <span className="w-4 text-center">
                        {item.status === 'pending' && '○'}
                        {item.status === 'processing' && (
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-accent rounded-full pulse-dot" />
                            <span className="w-1 h-1 bg-accent rounded-full pulse-dot delay-1" />
                            <span className="w-1 h-1 bg-accent rounded-full pulse-dot delay-2" />
                          </span>
                        )}
                        {item.status === 'done' && '✓'}
                        {item.status === 'error' && '✗'}
                      </span>
                      <span
                        className="truncate flex-1"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {item.url}
                      </span>
                      <span className="text-gray-600 shrink-0">
                        {item.viewport.label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Results Grid */}
            {results.length > 0 && (
              <section className="fade-in">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Screenshots ({results.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map((result, i) => (
                    <div
                      key={i}
                      className="screenshot-card bg-surface-1 rounded-xl border border-border overflow-hidden group"
                    >
                      {/* Screenshot preview */}
                      <div className="relative bg-surface-0 overflow-hidden" style={{ maxHeight: '360px' }}>
                        <img
                          src={`data:image/png;base64,${result.image}`}
                          alt={`Screenshot of ${result.url}`}
                          className="w-full object-cover object-top"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button
                          onClick={() => downloadScreenshot(result)}
                          className="absolute bottom-3 right-3 bg-surface-1/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:text-surface-0 font-medium"
                        >
                          Download
                        </button>
                      </div>
                      {/* Info */}
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p
                            className="text-xs text-gray-300 truncate"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {result.url.replace(/^https?:\/\//, '')}
                          </p>
                        </div>
                        <span className="text-xs text-muted shrink-0 ml-3 bg-surface-3 px-2 py-0.5 rounded">
                          {result.viewport.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: Settings Panel */}
          <aside className="space-y-6">
            {/* Viewport Presets */}
            <section className="bg-surface-1 rounded-xl border border-border p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Viewports
              </h2>
              {VIEWPORT_CATEGORIES.map((cat) => (
                <div key={cat.id} className="mb-4 last:mb-0">
                  <p className="text-xs text-muted mb-2 font-medium">{cat.label}</p>
                  <div className="space-y-1.5">
                    {VIEWPORT_PRESETS.filter((p) => p.category === cat.id).map(
                      (preset) => (
                        <button
                          key={preset.id}
                          onClick={() => toggleViewport(preset.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                            selectedViewports.includes(preset.id)
                              ? 'bg-accent/10 text-accent border border-accent/20'
                              : 'bg-surface-2 text-gray-400 hover:text-gray-200 border border-transparent hover:border-border'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{preset.icon}</span>
                            <span className="font-medium">{preset.label}</span>
                          </span>
                          <span
                            className="text-gray-600"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {preset.width}×{preset.height}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}

              {/* Custom viewport */}
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setShowCustom(!showCustom);
                    if (!showCustom && !selectedViewports.includes('custom')) {
                      setSelectedViewports((prev) => [...prev, 'custom']);
                    } else if (showCustom) {
                      setSelectedViewports((prev) =>
                        prev.filter((v) => v !== 'custom')
                      );
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    showCustom
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'bg-surface-2 text-gray-400 hover:text-gray-200 border border-transparent hover:border-border'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>⚙</span>
                    <span className="font-medium">Custom</span>
                  </span>
                </button>
                {showCustom && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted block mb-1">Width</label>
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Number(e.target.value))}
                        className="w-full bg-surface-0 border border-border rounded-md px-3 py-1.5 text-xs text-white"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Height</label>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Number(e.target.value))}
                        className="w-full bg-surface-0 border border-border rounded-md px-3 py-1.5 text-xs text-white"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Options */}
            <section className="bg-surface-1 rounded-xl border border-border p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Options
              </h2>
              <div className="space-y-4">
                {/* Full page toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">Full page</label>
                  <button
                    onClick={() => setFullPage(!fullPage)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      fullPage ? 'bg-accent' : 'bg-surface-4'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        fullPage ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
                {/* Wait time */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-300">Wait time</label>
                    <span
                      className="text-xs text-muted"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {waitTime}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={waitTime}
                    onChange={(e) => setWaitTime(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>0s</span>
                    <span>10s</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Action */}
            <button
              onClick={isProcessing ? stopCapture : startCapture}
              disabled={
                !isProcessing &&
                (parseUrls(urlInput).length === 0 ||
                  selectedViewports.length === 0)
              }
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                isProcessing
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                  : 'bg-accent text-surface-0 hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              {isProcessing ? 'Stop Capture' : 'Start Capture'}
            </button>

            {/* Stats */}
            {queue.length > 0 && (
              <div className="grid grid-cols-3 gap-3 fade-in">
                <div className="bg-surface-1 rounded-lg border border-border p-3 text-center">
                  <p
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {completedCount}
                  </p>
                  <p className="text-xs text-muted">Done</p>
                </div>
                <div className="bg-surface-1 rounded-lg border border-border p-3 text-center">
                  <p
                    className="text-lg font-bold text-red-400"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {errorCount}
                  </p>
                  <p className="text-xs text-muted">Failed</p>
                </div>
                <div className="bg-surface-1 rounded-lg border border-border p-3 text-center">
                  <p
                    className="text-lg font-bold text-accent"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {totalCount - completedCount - errorCount}
                  </p>
                  <p className="text-xs text-muted">Queued</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
