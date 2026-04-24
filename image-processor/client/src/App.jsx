import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Scaling, 
  Zap, 
  Download, 
  FileArchive,
  Check,
  Loader2,
  X,
  RefreshCw,
  Square,
  CheckSquare,
  CheckCircle2
} from 'lucide-react';

const API_BASE = '/api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDimensions(width, height) {
  return `${width} × ${height}`;
}

function calculateSavings(original, current) {
  const saved = ((original - current) / original) * 100;
  return saved > 0 ? `-${saved.toFixed(1)}%` : `+${Math.abs(saved).toFixed(1)}%`;
}

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [images, setImages] = useState([]);
  const [stage, setStage] = useState('upload'); // upload, uploaded, converted, resized, compressed
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('avif'); // avif or webp
  const [compressionCount, setCompressionCount] = useState(null);
  const [dragover, setDragover] = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const fileInputRef = useRef(null);

  // Fetch compression count on mount
  useEffect(() => {
    fetchCompressionCount();
  }, []);

  const fetchCompressionCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/compression-count`);
      const data = await res.json();
      setCompressionCount(data.compressionCount);
    } catch (err) {
      console.error('Failed to fetch compression count:', err);
    }
  };

  const handleFileSelect = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setProgress({ current: 0, total: files.length, phase: 'uploading' });
    setLoadingMessage(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`);
    
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('images', file);
    });
    
    try {
      // Use XMLHttpRequest for upload progress
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setProgress({ current: percentComplete, total: 100, phase: 'uploading' });
            setLoadingMessage(`Uploading... ${percentComplete}%`);
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
        
        xhr.open('POST', `${API_BASE}/upload`);
        
        xhr.send(formData);
      });
      
      setSessionId(response.sessionId);
      setImages(response.images.map(img => ({
        ...img,
        currentSize: img.currentSize,
        currentWidth: img.currentWidth,
        currentHeight: img.currentHeight,
        currentFormat: img.currentFormat
      })));
      // Select all images by default
      setSelectedImages(new Set(response.images.map(img => img.id)));
      setStage('uploaded');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
  }, []);

  const handleConvert = async () => {
    if (!sessionId) return;
    
    const imageIdsToConvert = Array.from(selectedImages);
    if (imageIdsToConvert.length === 0) {
      alert('Please select at least one image to convert');
      return;
    }
    
    setLoading(true);
    const total = imageIdsToConvert.length;
    
    try {
      for (let i = 0; i < imageIdsToConvert.length; i++) {
        const imageId = imageIdsToConvert[i];
        const img = images.find(img => img.id === imageId);
        
        setProgress({ current: i + 1, total, phase: 'converting' });
        setLoadingMessage(`Converting ${i + 1} of ${total}: ${img?.originalName || 'image'} to ${selectedFormat.toUpperCase()}...`);
        
        const res = await fetch(`${API_BASE}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            imageIds: [imageId],
            format: selectedFormat
          })
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Conversion failed');
        }
        
        const data = await res.json();
        
        // Update this specific image in state
        setImages(prev => prev.map(img => {
          const converted = data.images.find(c => c.id === img.id);
          if (converted) {
            return {
              ...img,
              currentSize: converted.convertedSize,
              currentWidth: converted.convertedWidth,
              currentHeight: converted.convertedHeight,
              currentFormat: converted.convertedFormat,
              convertedSize: converted.convertedSize,
              convertedFormat: converted.convertedFormat,
              targetFormat: converted.targetFormat,
              keptOriginal: converted.keptOriginal,
              convertedWouldBe: converted.convertedWouldBe,
              stage: 'converted'
            };
          }
          return img;
        }));
      }
      
      setStage('converted');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleResize = async () => {
    if (!selectedPreset || !sessionId) return;
    
    const imageIdsToResize = Array.from(selectedImages);
    if (imageIdsToResize.length === 0) {
      alert('Please select at least one image to resize');
      return;
    }
    
    setLoading(true);
    const total = imageIdsToResize.length;
    
    try {
      for (let i = 0; i < imageIdsToResize.length; i++) {
        const imageId = imageIdsToResize[i];
        const img = images.find(img => img.id === imageId);
        
        setProgress({ current: i + 1, total, phase: 'resizing' });
        setLoadingMessage(`Resizing ${i + 1} of ${total}: ${img?.originalName || 'image'}...`);
        
        const res = await fetch(`${API_BASE}/resize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            imageIds: [imageId],
            preset: selectedPreset
          })
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Resize failed');
        }
        
        const data = await res.json();
        
        // Update this specific image in state
        setImages(prev => prev.map(img => {
          const resized = data.images.find(r => r.id === img.id);
          if (resized) {
            return {
              ...img,
              currentSize: resized.resizedSize,
              currentWidth: resized.resizedWidth,
              currentHeight: resized.resizedHeight,
              resizedSize: resized.resizedSize,
              resizedWidth: resized.resizedWidth,
              resizedHeight: resized.resizedHeight,
              resizeSkipped: resized.skipped,
              stage: 'resized'
            };
          }
          return img;
        }));
      }
      
      setStage('resized');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleCompress = async () => {
    if (!sessionId) return;
    
    const imageIdsToCompress = Array.from(selectedImages);
    if (imageIdsToCompress.length === 0) {
      alert('Please select at least one image to compress');
      return;
    }
    
    // Confirm if compressing many images
    if (imageIdsToCompress.length > 5) {
      const confirm = window.confirm(`This will use ${imageIdsToCompress.length} TinyPNG credits. Continue?`);
      if (!confirm) return;
    }
    
    setLoading(true);
    const total = imageIdsToCompress.length;
    
    try {
      for (let i = 0; i < imageIdsToCompress.length; i++) {
        const imageId = imageIdsToCompress[i];
        const img = images.find(img => img.id === imageId);
        
        setProgress({ current: i + 1, total, phase: 'compressing' });
        setLoadingMessage(`Compressing ${i + 1} of ${total}: ${img?.originalName || 'image'}...`);
        
        const res = await fetch(`${API_BASE}/compress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            imageIds: [imageId]
          })
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Compression failed');
        }
        
        const data = await res.json();
        
        if (data.compressionCount !== null) {
          setCompressionCount(data.compressionCount);
        }
        
        // Update this specific image in state
        setImages(prev => prev.map(img => {
          const compressed = data.images.find(c => c.id === img.id);
          if (compressed) {
            return {
              ...img,
              currentSize: compressed.compressedSize,
              currentFormat: 'avif',
              compressedSize: compressed.compressedSize,
              compressedWidth: compressed.compressedWidth,
              compressedHeight: compressed.compressedHeight,
              stage: 'compressed'
            };
          }
          return img;
        }));
      }
      
      setStage('compressed');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleDownloadSingle = (imageId) => {
    window.open(`${API_BASE}/download/${sessionId}/${imageId}`, '_blank');
  };

  const handleDownloadAll = () => {
    window.open(`${API_BASE}/download-all/${sessionId}`, '_blank');
  };

  const handleReset = () => {
    setSessionId(null);
    setImages([]);
    setStage('upload');
    setSelectedPreset(null);
    setSelectedFormat('avif');
    setSelectedImages(new Set());
    setProgress({ current: 0, total: 0, phase: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const selectAllImages = () => {
    setSelectedImages(new Set(images.map(img => img.id)));
  };

  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };

  const totalOriginalSize = images.reduce((acc, img) => acc + img.originalSize, 0);
  const totalCurrentSize = images.reduce((acc, img) => acc + img.currentSize, 0);

  const resizePresets = [
    { value: '1k', label: '1K', desc: '1000px' },
    { value: '1.5k', label: '1.5K', desc: '1500px' },
    { value: '2k', label: '2K', desc: '2000px' },
    { value: '3k', label: '3K', desc: '3000px' },
  ];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Image Processor</h1>
        <p>Convert, resize, and compress images to optimized AVIF format</p>
        
        {compressionCount !== null && (
          <div className="api-counter">
            <div className="api-counter-dot" />
            <span>TinyPNG:</span>
            <strong>{compressionCount} / 500</strong>
            <span>this month</span>
          </div>
        )}
        
        <button 
          className="btn btn-ghost quit-btn"
          onClick={() => {
            if (confirm('Shut down Image Processor?')) {
              fetch('/api/shutdown', { method: 'POST' });
              setTimeout(() => window.close(), 500);
            }
          }}
          title="Quit and stop server"
        >
          <X size={18} />
          Quit
        </button>
      </header>

      {/* Upload Zone - Always visible when no images */}
      {stage === 'upload' && (
        <div 
          className={`upload-zone ${dragover ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="upload-zone-icon" />
          <h3>Drop images here or click to upload</h3>
          <p>Supports PNG, JPEG, WebP, AVIF • Multiple files supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-header">
              <div className="spinner" />
              <span>{loadingMessage}</span>
            </div>
            {progress.total > 0 && (
              <div className="loading-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: progress.phase === 'uploading' 
                        ? `${progress.current}%` 
                        : `${(progress.current / progress.total) * 100}%` 
                    }} 
                  />
                </div>
                <div className="progress-text">
                  {progress.phase === 'uploading' 
                    ? `${progress.current}%`
                    : `${progress.current} of ${progress.total}`
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Stages */}
      {images.length > 0 && !loading && (
        <div className="pipeline">
          {/* Stage 1: Uploaded Images + Convert Option */}
          <div className={`stage active`}>
            <div className="stage-header">
              <div className="stage-title">
                <div className="stage-number">1</div>
                <div>
                  <h3>Images</h3>
                  <p>{images.length} image{images.length > 1 ? 's' : ''} uploaded</p>
                </div>
              </div>
              <div className="stage-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadAll}>
                  <FileArchive size={16} />
                  Download All (.zip)
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <div className="stage-content">
              {/* Selection controls */}
              {images.length > 1 && (
                <div className="selection-controls">
                  <span className="selection-count">
                    {selectedImages.size} of {images.length} selected
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={selectAllImages}>
                    <CheckSquare size={14} />
                    Select All
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={deselectAllImages}>
                    <Square size={14} />
                    Deselect All
                  </button>
                </div>
              )}
              <div className="image-grid">
                {images.map(img => (
                  <div 
                    key={img.id} 
                    className={`image-card selectable ${selectedImages.has(img.id) ? 'selected' : ''}`}
                    onClick={() => toggleImageSelection(img.id)}
                  >
                    <div className="image-card-checkbox">
                      {selectedImages.has(img.id) 
                        ? <CheckSquare size={20} className="checkbox-checked" />
                        : <Square size={20} className="checkbox-unchecked" />
                      }
                    </div>
                    <div className="image-card-preview">
                      <ImageIcon size={32} style={{ color: 'var(--slate-600)' }} />
                      <span className="format-badge">{(img.currentFormat || img.originalFormat).toUpperCase()}</span>
                    </div>
                    <div className="image-card-info">
                      <div className="image-card-name" title={img.originalName}>
                        {img.originalName}
                      </div>
                      <div className="image-card-stats">
                        <div className="stat-row">
                          <span className="stat-label">Format</span>
                          <span className="stat-value">{(img.currentFormat || img.originalFormat).toUpperCase()}</span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Size</span>
                          <span className={`stat-value ${img.stage === 'converted' ? 'highlight' : ''}`}>
                            {formatBytes(img.currentSize)}
                            {img.keptOriginal && img.convertedWouldBe && (
                              <span style={{ color: 'var(--warning)', marginLeft: '4px' }}>
                                ({img.targetFormat?.toUpperCase()} was {formatBytes(img.convertedWouldBe)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Dimensions</span>
                          <span className="stat-value">{formatDimensions(img.currentWidth, img.currentHeight)}</span>
                        </div>
                      </div>
                      <div className="image-card-download">
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); handleDownloadSingle(img.id); }}
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Convert action */}
              <div className="action-section">
                <h4>Convert Format (Optional)</h4>
                <div className="format-selector">
                  <button
                    className={`preset-btn ${selectedFormat === 'avif' ? 'active' : ''}`}
                    onClick={() => setSelectedFormat('avif')}
                  >
                    AVIF
                    <span>Best compression</span>
                  </button>
                  <button
                    className={`preset-btn ${selectedFormat === 'webp' ? 'active' : ''}`}
                    onClick={() => setSelectedFormat('webp')}
                  >
                    WebP
                    <span>Wide support</span>
                  </button>
                </div>
                <button 
                  className="btn btn-primary"
                  disabled={selectedImages.size === 0}
                  onClick={handleConvert}
                >
                  <RefreshCw size={16} />
                  Convert {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''} to {selectedFormat.toUpperCase()}
                </button>
                <span className="btn-hint">
                  {selectedImages.size === 0 ? 'Select images above' : 'Keeps original if smaller'}
                </span>
              </div>
            </div>
          </div>

          {/* Stage 2: Resize */}
          <div className={`stage`}>
            <div className="stage-header">
              <div className="stage-title">
                <div className="stage-number">2</div>
                <div>
                  <h3>Resize (Optional)</h3>
                  <p>Scale to longest side (downscale only)</p>
                </div>
              </div>
            </div>
            <div className="stage-content">
              <div className="resize-presets">
                {resizePresets.map(preset => (
                  <button
                    key={preset.value}
                    className={`preset-btn ${selectedPreset === preset.value ? 'active' : ''}`}
                    onClick={() => setSelectedPreset(preset.value)}
                  >
                    {preset.label}
                    <span>{preset.desc}</span>
                  </button>
                ))}
              </div>
              <button 
                className="btn btn-primary"
                disabled={!selectedPreset || selectedImages.size === 0}
                onClick={handleResize}
              >
                <Scaling size={16} />
                Resize {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''}
              </button>
              <span className="btn-hint">
                {selectedImages.size === 0 ? 'Select images above' : `${selectedImages.size} of ${images.length} selected`}
              </span>
            </div>
          </div>

          {/* Stage 3: Compress */}
          <div className={`stage`}>
            <div className="stage-header">
              <div className="stage-title">
                <div className="stage-number">3</div>
                <div>
                  <h3>Compress (Optional)</h3>
                  <p>TinyPNG optimization</p>
                </div>
              </div>
            </div>
            <div className="stage-content">
              <div className="compress-section">
                <button 
                  className="btn btn-primary"
                  disabled={selectedImages.size === 0}
                  onClick={handleCompress}
                >
                  <Zap size={16} />
                  Compress {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''}
                </button>
                <span className="btn-hint">
                  {selectedImages.size === 0 
                    ? 'Select images above' 
                    : `Uses ${selectedImages.size} API credit${selectedImages.size !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Summary Bar */}
          {images.length > 0 && (
            <div className="download-bar">
              <div className="download-bar-info">
                <span>Total:</span>
                <strong>{formatBytes(totalOriginalSize)}</strong>
                <span>→</span>
                <strong style={{ color: 'var(--accent)' }}>{formatBytes(totalCurrentSize)}</strong>
                <span style={{ color: 'var(--success)' }}>
                  ({calculateSavings(totalOriginalSize, totalCurrentSize)})
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleDownloadAll}>
                <FileArchive size={16} />
                Download All as ZIP
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
