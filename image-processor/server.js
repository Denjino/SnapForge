const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// TinyPNG API configuration
const TINYPNG_API_KEY = '1psJDWQXZ9KhH2H0HMJrRMJVWXd6PHNR';
const TINYPNG_AUTH = Buffer.from(`api:${TINYPNG_API_KEY}`).toString('base64');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, WebP, and AVIF are allowed.'));
    }
  }
});

app.use(express.static('public'));
app.use(express.json());

// Store processed images in memory (for internal use)
const imageStore = new Map();

// Track compression count from API
let lastCompressionCount = null;

// Helper to generate unique IDs
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// Upload and convert to AVIF
app.post('/api/upload', upload.array('images', 50), async (req, res) => {
  try {
    const results = [];
    
    for (const file of req.files) {
      const imageId = generateId();
      
      // Upload to TinyPNG
      const uploadResponse = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`
        },
        body: file.buffer
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.message || 'Failed to upload to TinyPNG');
      }

      const uploadData = await uploadResponse.json();
      const outputUrl = uploadResponse.headers.get('location');
      lastCompressionCount = uploadResponse.headers.get('compression-count');

      // Convert to AVIF
      const convertResponse = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convert: { type: 'image/avif' }
        })
      });

      if (!convertResponse.ok) {
        const error = await convertResponse.json();
        throw new Error(error.message || 'Failed to convert image');
      }

      lastCompressionCount = convertResponse.headers.get('compression-count');
      const width = parseInt(convertResponse.headers.get('image-width'));
      const height = parseInt(convertResponse.headers.get('image-height'));
      const convertedBuffer = await convertResponse.buffer();

      // Store the image
      imageStore.set(imageId, {
        id: imageId,
        originalName: file.originalname.replace(/\.[^/.]+$/, '') + '.avif',
        buffer: convertedBuffer,
        width,
        height,
        size: convertedBuffer.length,
        originalSize: file.size,
        originalType: file.mimetype,
        tinypngOutputUrl: outputUrl
      });

      results.push({
        id: imageId,
        name: file.originalname.replace(/\.[^/.]+$/, '') + '.avif',
        originalSize: file.size,
        convertedSize: convertedBuffer.length,
        width,
        height,
        compressionCount: lastCompressionCount
      });
    }

    res.json({ 
      success: true, 
      images: results,
      compressionCount: lastCompressionCount
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resize image
app.post('/api/resize/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { maxDimension } = req.body;

    const image = imageStore.get(id);
    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Calculate new dimensions
    const longestSide = Math.max(image.width, image.height);
    
    // Only downscale
    if (longestSide <= maxDimension) {
      return res.json({
        success: true,
        message: 'Image already smaller than target dimension',
        id,
        width: image.width,
        height: image.height,
        size: image.size,
        compressionCount: lastCompressionCount
      });
    }

    // Upload current buffer to TinyPNG for resize
    const uploadResponse = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${TINYPNG_AUTH}`
      },
      body: image.buffer
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.message || 'Failed to upload for resize');
    }

    const outputUrl = uploadResponse.headers.get('location');
    lastCompressionCount = uploadResponse.headers.get('compression-count');

    // Calculate target dimensions using scale method
    let targetWidth, targetHeight;
    if (image.width >= image.height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((image.height / image.width) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((image.width / image.height) * maxDimension);
    }

    // Resize using fit method with calculated dimensions
    const resizeResponse = await fetch(outputUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${TINYPNG_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resize: {
          method: 'fit',
          width: targetWidth,
          height: targetHeight
        },
        convert: { type: 'image/avif' }
      })
    });

    if (!resizeResponse.ok) {
      const error = await resizeResponse.json();
      throw new Error(error.message || 'Failed to resize image');
    }

    lastCompressionCount = resizeResponse.headers.get('compression-count');
    const newWidth = parseInt(resizeResponse.headers.get('image-width'));
    const newHeight = parseInt(resizeResponse.headers.get('image-height'));
    const resizedBuffer = await resizeResponse.buffer();

    // Update stored image
    image.buffer = resizedBuffer;
    image.width = newWidth;
    image.height = newHeight;
    image.size = resizedBuffer.length;

    res.json({
      success: true,
      id,
      width: newWidth,
      height: newHeight,
      size: resizedBuffer.length,
      compressionCount: lastCompressionCount
    });
  } catch (error) {
    console.error('Resize error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compress image (additional compression pass)
app.post('/api/compress/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = imageStore.get(id);
    
    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Upload to TinyPNG for compression
    const uploadResponse = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${TINYPNG_AUTH}`
      },
      body: image.buffer
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.message || 'Failed to compress');
    }

    const outputUrl = uploadResponse.headers.get('location');
    lastCompressionCount = uploadResponse.headers.get('compression-count');

    // Download compressed version (keeping as AVIF)
    const downloadResponse = await fetch(outputUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${TINYPNG_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        convert: { type: 'image/avif' }
      })
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.message || 'Failed to download compressed image');
    }

    lastCompressionCount = downloadResponse.headers.get('compression-count');
    const compressedBuffer = await downloadResponse.buffer();

    // Update stored image
    const previousSize = image.size;
    image.buffer = compressedBuffer;
    image.size = compressedBuffer.length;

    res.json({
      success: true,
      id,
      previousSize,
      size: compressedBuffer.length,
      width: image.width,
      height: image.height,
      compressionCount: lastCompressionCount
    });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch resize all images
app.post('/api/resize-all', async (req, res) => {
  try {
    const { ids, maxDimension } = req.body;
    const results = [];

    for (const id of ids) {
      const image = imageStore.get(id);
      if (!image) continue;

      const longestSide = Math.max(image.width, image.height);
      
      // Only downscale
      if (longestSide <= maxDimension) {
        results.push({
          id,
          width: image.width,
          height: image.height,
          size: image.size,
          skipped: true
        });
        continue;
      }

      // Upload current buffer to TinyPNG for resize
      const uploadResponse = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`
        },
        body: image.buffer
      });

      if (!uploadResponse.ok) continue;

      const outputUrl = uploadResponse.headers.get('location');
      lastCompressionCount = uploadResponse.headers.get('compression-count');

      // Calculate target dimensions
      let targetWidth, targetHeight;
      if (image.width >= image.height) {
        targetWidth = maxDimension;
        targetHeight = Math.round((image.height / image.width) * maxDimension);
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.round((image.width / image.height) * maxDimension);
      }

      const resizeResponse = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resize: {
            method: 'fit',
            width: targetWidth,
            height: targetHeight
          },
          convert: { type: 'image/avif' }
        })
      });

      if (!resizeResponse.ok) continue;

      lastCompressionCount = resizeResponse.headers.get('compression-count');
      const newWidth = parseInt(resizeResponse.headers.get('image-width'));
      const newHeight = parseInt(resizeResponse.headers.get('image-height'));
      const resizedBuffer = await resizeResponse.buffer();

      image.buffer = resizedBuffer;
      image.width = newWidth;
      image.height = newHeight;
      image.size = resizedBuffer.length;

      results.push({
        id,
        width: newWidth,
        height: newHeight,
        size: resizedBuffer.length,
        skipped: false
      });
    }

    res.json({
      success: true,
      results,
      compressionCount: lastCompressionCount
    });
  } catch (error) {
    console.error('Batch resize error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch compress all images
app.post('/api/compress-all', async (req, res) => {
  try {
    const { ids } = req.body;
    const results = [];

    for (const id of ids) {
      const image = imageStore.get(id);
      if (!image) continue;

      const uploadResponse = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`
        },
        body: image.buffer
      });

      if (!uploadResponse.ok) continue;

      const outputUrl = uploadResponse.headers.get('location');
      lastCompressionCount = uploadResponse.headers.get('compression-count');

      const downloadResponse = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${TINYPNG_AUTH}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convert: { type: 'image/avif' }
        })
      });

      if (!downloadResponse.ok) continue;

      lastCompressionCount = downloadResponse.headers.get('compression-count');
      const compressedBuffer = await downloadResponse.buffer();

      const previousSize = image.size;
      image.buffer = compressedBuffer;
      image.size = compressedBuffer.length;

      results.push({
        id,
        previousSize,
        size: compressedBuffer.length,
        width: image.width,
        height: image.height
      });
    }

    res.json({
      success: true,
      results,
      compressionCount: lastCompressionCount
    });
  } catch (error) {
    console.error('Batch compress error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download single image
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  const image = imageStore.get(id);
  
  if (!image) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  res.set({
    'Content-Type': 'image/avif',
    'Content-Disposition': `attachment; filename="${image.originalName}"`,
    'Content-Length': image.buffer.length
  });
  res.send(image.buffer);
});

// Download all as ZIP
app.post('/api/download-zip', async (req, res) => {
  try {
    const { ids } = req.body;
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="processed-images.zip"'
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const id of ids) {
      const image = imageStore.get(id);
      if (image) {
        archive.append(image.buffer, { name: image.originalName });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get compression count
app.get('/api/compression-count', (req, res) => {
  res.json({ 
    success: true, 
    compressionCount: lastCompressionCount 
  });
});

// Clear stored images
app.post('/api/clear', (req, res) => {
  imageStore.clear();
  res.json({ success: true });
});

// Get image info
app.get('/api/image/:id', (req, res) => {
  const { id } = req.params;
  const image = imageStore.get(id);
  
  if (!image) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }

  res.json({
    success: true,
    id: image.id,
    name: image.originalName,
    width: image.width,
    height: image.height,
    size: image.size,
    originalSize: image.originalSize
  });
});

app.listen(PORT, () => {
  console.log(`Image Processor running at http://localhost:${PORT}`);
});
