'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Download,
  FileArchive,
  Image as ImageIcon,
  RefreshCw,
  Scaling,
  Square,
  Upload,
  Zap,
} from 'lucide-react';
import { getSetting } from '@/lib/settings-client';
import './image-processor.css';

type Stage = 'upload' | 'uploaded' | 'converted' | 'resized' | 'compressed';
type Phase = '' | 'uploading' | 'converting' | 'resizing' | 'compressing';

interface UIImage {
  id: string;
  originalName: string;
  originalFormat: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  currentSize: number;
  currentWidth: number;
  currentHeight: number;
  currentFormat: string;
  stage: string;
  keptOriginal?: boolean;
  convertedWouldBe?: number;
  targetFormat?: string;
  resizeSkipped?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDimensions(w: number, h: number): string {
  return `${w} × ${h}`;
}

function calculateSavings(original: number, current: number): string {
  if (!original) return '0%';
  const saved = ((original - current) / original) * 100;
  return saved > 0 ? `-${saved.toFixed(1)}%` : `+${Math.abs(saved).toFixed(1)}%`;
}

export default function ImageProcessorPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [images, setImages] = useState<UIImage[]>([]);
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'avif' | 'webp'>('avif');
  const [compressionCount, setCompressionCount] = useState<number | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [dragover, setDragover] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ current: number; total: number; phase: Phase }>(
    { current: 0, total: 0, phase: '' }
  );
  const [showKeyModal, setShowKeyModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Image Processor';
  }, []);

  // Read the TinyPNG key on mount and fetch compression count if present.
  // Never ship the key in state — we read it fresh per compress call.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await getSetting('tinypngApiKey');
      if (cancelled) return;
      const present = !!key;
      setHasKey(present);
      if (present) {
        try {
          const res = await fetch('/api/image/compression-count', {
            headers: { 'X-TinyPNG-Key': key },
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setCompressionCount(data.compressionCount ?? null);
          }
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    setProgress({ current: 0, total: files.length, phase: 'uploading' });
    setLoadingMessage(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setProgress({ current: percent, total: 100, phase: 'uploading' });
            setLoadingMessage(`Uploading... ${percent}%`);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', '/api/image/upload');
        xhr.send(formData);
      });

      setSessionId(response.sessionId);
      setImages(response.images);
      setSelectedImages(new Set(response.images.map((img: UIImage) => img.id)));
      setStage('uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragover(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
  }, []);

  const handleConvert = async () => {
    if (!sessionId) return;
    const ids = Array.from(selectedImages);
    if (ids.length === 0) {
      alert('Please select at least one image to convert');
      return;
    }
    setLoading(true);
    const total = ids.length;
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const img = images.find((x) => x.id === id);
        setProgress({ current: i + 1, total, phase: 'converting' });
        setLoadingMessage(
          `Converting ${i + 1} of ${total}: ${img?.originalName ?? 'image'} to ${selectedFormat.toUpperCase()}...`
        );
        const res = await fetch('/api/image/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, imageIds: [id], format: selectedFormat }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Conversion failed');
        }
        const data = await res.json();
        setImages((prev) =>
          prev.map((img) => {
            const c = data.images.find((x: any) => x.id === img.id);
            if (c) {
              return {
                ...img,
                currentSize: c.convertedSize,
                currentWidth: c.convertedWidth,
                currentHeight: c.convertedHeight,
                currentFormat: c.convertedFormat,
                keptOriginal: c.keptOriginal,
                convertedWouldBe: c.convertedWouldBe,
                targetFormat: c.targetFormat,
                stage: 'converted',
              };
            }
            return img;
          })
        );
      }
      setStage('converted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleResize = async () => {
    if (!selectedPreset || !sessionId) return;
    const ids = Array.from(selectedImages);
    if (ids.length === 0) {
      alert('Please select at least one image to resize');
      return;
    }
    setLoading(true);
    const total = ids.length;
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const img = images.find((x) => x.id === id);
        setProgress({ current: i + 1, total, phase: 'resizing' });
        setLoadingMessage(`Resizing ${i + 1} of ${total}: ${img?.originalName ?? 'image'}...`);
        const res = await fetch('/api/image/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, imageIds: [id], preset: selectedPreset }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Resize failed');
        }
        const data = await res.json();
        setImages((prev) =>
          prev.map((img) => {
            const r = data.images.find((x: any) => x.id === img.id);
            if (r) {
              return {
                ...img,
                currentSize: r.resizedSize,
                currentWidth: r.resizedWidth,
                currentHeight: r.resizedHeight,
                resizeSkipped: r.skipped,
                stage: 'resized',
              };
            }
            return img;
          })
        );
      }
      setStage('resized');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resize failed';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleCompress = async () => {
    if (!sessionId) return;
    const ids = Array.from(selectedImages);
    if (ids.length === 0) {
      alert('Please select at least one image to compress');
      return;
    }

    // Read the key fresh — don't keep it in component state.
    const key = await getSetting('tinypngApiKey');
    if (!key) {
      setShowKeyModal(true);
      return;
    }

    if (ids.length > 5) {
      const ok = window.confirm(
        `This will use ${ids.length} TinyPNG credits. Continue?`
      );
      if (!ok) return;
    }

    setLoading(true);
    const total = ids.length;
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const img = images.find((x) => x.id === id);
        setProgress({ current: i + 1, total, phase: 'compressing' });
        setLoadingMessage(`Compressing ${i + 1} of ${total}: ${img?.originalName ?? 'image'}...`);
        const res = await fetch('/api/image/compress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TinyPNG-Key': key,
          },
          body: JSON.stringify({ sessionId, imageIds: [id] }),
        });
        if (!res.ok) {
          const err = await res.json();
          if (err.code === 'TINYPNG_KEY_MISSING') {
            setShowKeyModal(true);
            return;
          }
          throw new Error(err.error || 'Compression failed');
        }
        const data = await res.json();
        if (data.compressionCount !== null) setCompressionCount(data.compressionCount);
        setImages((prev) =>
          prev.map((img) => {
            const c = data.images.find((x: any) => x.id === img.id);
            if (c) {
              return {
                ...img,
                currentSize: c.compressedSize,
                currentWidth: c.compressedWidth,
                currentHeight: c.compressedHeight,
                stage: 'compressed',
              };
            }
            return img;
          })
        );
      }
      setStage('compressed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compression failed';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleDownloadSingle = (imageId: string) => {
    if (!sessionId) return;
    window.open(`/api/image/download/${sessionId}/${imageId}`, '_blank');
  };

  const handleDownloadAll = () => {
    if (!sessionId) return;
    window.open(`/api/image/zip/${sessionId}`, '_blank');
  };

  const handleReset = () => {
    setSessionId(null);
    setImages([]);
    setStage('upload');
    setSelectedPreset(null);
    setSelectedFormat('avif');
    setSelectedImages(new Set());
    setProgress({ current: 0, total: 0, phase: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleImage = (id: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedImages(new Set(images.map((i) => i.id)));
  const deselectAll = () => setSelectedImages(new Set());

  const totalOriginal = images.reduce((a, i) => a + i.originalSize, 0);
  const totalCurrent = images.reduce((a, i) => a + i.currentSize, 0);

  const resizePresets = [
    { value: '1k', label: '1K', desc: '1000px' },
    { value: '1.5k', label: '1.5K', desc: '1500px' },
    { value: '2k', label: '2K', desc: '2000px' },
    { value: '3k', label: '3K', desc: '3000px' },
  ];

  return (
    <div className="ip-root">
      <header className="ip-header">
        <p className="ip-header-eyebrow">Image Processor</p>
        <h1>Convert, resize, and compress</h1>
        <p>Pipeline: AVIF/WebP conversion → Sharp resize → TinyPNG compression</p>
        {hasKey && compressionCount !== null && (
          <div className="ip-api-counter">
            <div className="ip-api-counter-dot" />
            <span>TinyPNG:</span>
            <strong>
              {compressionCount} / 500
            </strong>
            <span>this month</span>
          </div>
        )}
        {!hasKey && (
          <Link href="/settings" className="ip-api-missing">
            <span>⚠</span>
            <span>TinyPNG key not set — add one in Settings to enable compression.</span>
          </Link>
        )}
      </header>

      {stage === 'upload' && (
        <div
          className={`ip-upload-zone ${dragover ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="ip-upload-zone-icon" />
          <h3>Drop images here or click to upload</h3>
          <p>Supports PNG, JPEG, WebP, AVIF · up to 50MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {loading && (
        <div className="ip-loading-overlay">
          <div className="ip-loading-content">
            <div className="ip-loading-header">
              <div className="ip-spinner" />
              <span>{loadingMessage}</span>
            </div>
            {progress.total > 0 && (
              <div className="ip-loading-progress">
                <div className="ip-progress-bar">
                  <div
                    className="ip-progress-bar-fill"
                    style={{
                      width:
                        progress.phase === 'uploading'
                          ? `${progress.current}%`
                          : `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="ip-progress-text">
                  {progress.phase === 'uploading'
                    ? `${progress.current}%`
                    : `${progress.current} of ${progress.total}`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showKeyModal && (
        <div className="ip-modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
            <h3>TinyPNG API key required</h3>
            <p>
              Compression uses tinify.com. Add your personal API key in Settings — it's
              stored locally on this machine and never leaves your computer except to
              reach tinypng.com directly.
            </p>
            <div className="ip-modal-actions">
              <button
                type="button"
                className="ip-btn ip-btn-ghost"
                onClick={() => setShowKeyModal(false)}
              >
                Cancel
              </button>
              <Link href="/settings" className="ip-btn ip-btn-primary">
                Open Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {images.length > 0 && !loading && (
        <div className="ip-pipeline">
          {/* Stage 1: images + convert */}
          <section className="ip-stage active">
            <div className="ip-stage-header">
              <div className="ip-stage-title">
                <div className="ip-stage-number">1</div>
                <div>
                  <h3>Images</h3>
                  <p>
                    {images.length} image{images.length > 1 ? 's' : ''} uploaded
                  </p>
                </div>
              </div>
              <div className="ip-stage-actions">
                <button
                  type="button"
                  className="ip-btn ip-btn-secondary ip-btn-sm"
                  onClick={handleDownloadAll}
                >
                  <FileArchive size={14} />
                  Download All (.zip)
                </button>
                <button
                  type="button"
                  className="ip-btn ip-btn-ghost ip-btn-sm"
                  onClick={handleReset}
                >
                  <RefreshCw size={14} />
                  Reset
                </button>
              </div>
            </div>
            <div className="ip-stage-content">
              {images.length > 1 && (
                <div className="ip-selection-controls">
                  <span className="ip-selection-count">
                    {selectedImages.size} of {images.length} selected
                  </span>
                  <button
                    type="button"
                    className="ip-btn ip-btn-ghost ip-btn-sm"
                    onClick={selectAll}
                  >
                    <CheckSquare size={12} /> Select all
                  </button>
                  <button
                    type="button"
                    className="ip-btn ip-btn-ghost ip-btn-sm"
                    onClick={deselectAll}
                  >
                    <Square size={12} /> Deselect all
                  </button>
                </div>
              )}
              <div className="ip-image-grid">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`ip-image-card ${
                      selectedImages.has(img.id) ? 'selected' : ''
                    }`}
                    onClick={() => toggleImage(img.id)}
                  >
                    <div className="ip-image-card-checkbox">
                      {selectedImages.has(img.id) ? (
                        <CheckSquare size={16} className="ip-check-checked" />
                      ) : (
                        <Square size={16} className="ip-check-unchecked" />
                      )}
                    </div>
                    <div className="ip-image-card-preview">
                      <ImageIcon size={28} style={{ color: 'var(--ip-text-muted)' }} />
                      <span className="ip-format-badge">
                        {(img.currentFormat || img.originalFormat).toUpperCase()}
                      </span>
                    </div>
                    <div className="ip-image-card-info">
                      <div className="ip-image-card-name" title={img.originalName}>
                        {img.originalName}
                      </div>
                      <div>
                        <div className="ip-stat-row">
                          <span className="ip-stat-label">Size</span>
                          <span
                            className={`ip-stat-value ${
                              img.stage === 'converted' ? 'highlight' : ''
                            }`}
                          >
                            {formatBytes(img.currentSize)}
                            {img.keptOriginal && img.convertedWouldBe !== undefined && (
                              <span style={{ color: 'var(--ip-warning)', marginLeft: 4 }}>
                                ({img.targetFormat?.toUpperCase()} was{' '}
                                {formatBytes(img.convertedWouldBe)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="ip-stat-row">
                          <span className="ip-stat-label">Dimensions</span>
                          <span className="ip-stat-value">
                            {formatDimensions(img.currentWidth, img.currentHeight)}
                          </span>
                        </div>
                      </div>
                      <div className="ip-image-card-download">
                        <button
                          type="button"
                          className="ip-btn ip-btn-secondary ip-btn-sm"
                          style={{ width: '100%' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingle(img.id);
                          }}
                        >
                          <Download size={12} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ip-action-section">
                <h4>Convert format (optional)</h4>
                <div className="ip-preset-grid">
                  <button
                    type="button"
                    className={`ip-preset-btn ${selectedFormat === 'avif' ? 'active' : ''}`}
                    onClick={() => setSelectedFormat('avif')}
                  >
                    AVIF
                    <span>Best compression</span>
                  </button>
                  <button
                    type="button"
                    className={`ip-preset-btn ${selectedFormat === 'webp' ? 'active' : ''}`}
                    onClick={() => setSelectedFormat('webp')}
                  >
                    WebP
                    <span>Wide support</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="ip-btn ip-btn-primary"
                  disabled={selectedImages.size === 0}
                  onClick={handleConvert}
                >
                  <RefreshCw size={14} />
                  Convert {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} to{' '}
                  {selectedFormat.toUpperCase()}
                </button>
                <span className="ip-btn-hint">
                  {selectedImages.size === 0
                    ? 'Select images above'
                    : 'Keeps original if the converted version is larger.'}
                </span>
              </div>
            </div>
          </section>

          {/* Stage 2: resize */}
          <section className="ip-stage">
            <div className="ip-stage-header">
              <div className="ip-stage-title">
                <div className="ip-stage-number">2</div>
                <div>
                  <h3>Resize (optional)</h3>
                  <p>Scale to longest side — downscale only</p>
                </div>
              </div>
            </div>
            <div className="ip-stage-content">
              <div className="ip-preset-grid">
                {resizePresets.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    className={`ip-preset-btn ${selectedPreset === p.value ? 'active' : ''}`}
                    onClick={() => setSelectedPreset(p.value)}
                  >
                    {p.label}
                    <span>{p.desc}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ip-btn ip-btn-primary"
                disabled={!selectedPreset || selectedImages.size === 0}
                onClick={handleResize}
              >
                <Scaling size={14} />
                Resize {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''}
              </button>
              <span className="ip-btn-hint">
                {selectedImages.size === 0
                  ? 'Select images above'
                  : `${selectedImages.size} of ${images.length} selected`}
              </span>
            </div>
          </section>

          {/* Stage 3: compress */}
          <section className="ip-stage">
            <div className="ip-stage-header">
              <div className="ip-stage-title">
                <div className="ip-stage-number">3</div>
                <div>
                  <h3>Compress (optional)</h3>
                  <p>TinyPNG lossy optimisation</p>
                </div>
              </div>
            </div>
            <div className="ip-stage-content">
              <button
                type="button"
                className="ip-btn ip-btn-primary"
                disabled={selectedImages.size === 0}
                onClick={handleCompress}
              >
                <Zap size={14} />
                Compress {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''}
              </button>
              <span className="ip-btn-hint">
                {!hasKey ? (
                  <>
                    TinyPNG key not set.{' '}
                    <Link href="/settings" style={{ color: 'var(--ip-accent)' }}>
                      Open Settings
                    </Link>
                  </>
                ) : selectedImages.size === 0 ? (
                  'Select images above.'
                ) : (
                  `Uses ${selectedImages.size} TinyPNG credit${selectedImages.size !== 1 ? 's' : ''}.`
                )}
              </span>
            </div>
          </section>

          {images.length > 0 && (
            <div className="ip-download-bar">
              <div className="ip-download-bar-info">
                <span>Total:</span>
                <strong>{formatBytes(totalOriginal)}</strong>
                <span>→</span>
                <strong style={{ color: 'var(--ip-accent)' }}>
                  {formatBytes(totalCurrent)}
                </strong>
                <span className="ip-savings">
                  ({calculateSavings(totalOriginal, totalCurrent)})
                </span>
              </div>
              <button
                type="button"
                className="ip-btn ip-btn-primary"
                onClick={handleDownloadAll}
              >
                <FileArchive size={14} />
                Download all as ZIP
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
