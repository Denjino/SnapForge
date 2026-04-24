import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// TinyPNG API key
const TINYPNG_API_KEY = '1psJDWQXZ9KhH2H0HMJrRMJVWXd6PHNR';

// Storage for processed images
const uploadsDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');

// Ensure directories exist
await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(processedDir, { recursive: true });

// In-memory store for image sessions
const imageSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/processed', express.static(processedDir));

// Serve static files from client build
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Multer configuration
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

// Helper function to get image dimensions
async function getImageInfo(buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length
  };
}

// Helper function to calculate resize dimensions
function calculateResizeDimensions(width, height, targetLongSide) {
  const longSide = Math.max(width, height);
  
  // Don't upscale
  if (longSide <= targetLongSide) {
    return { width, height, skipped: true };
  }
  
  const ratio = targetLongSide / longSide;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
    skipped: false
  };
}

// Upload images (no conversion - just store originals)
app.post('/api/upload', upload.array('images', 50), async (req, res) => {
  try {
    const sessionId = uuidv4();
    const results = [];
    
    for (const file of req.files) {
      const imageId = uuidv4();
      const originalInfo = await getImageInfo(file.buffer);
      
      // Store original file
      const ext = originalInfo.format === 'jpeg' ? 'jpg' : originalInfo.format;
      const filename = `${imageId}.${ext}`;
      const filepath = path.join(processedDir, filename);
      
      await fs.writeFile(filepath, file.buffer);
      
      const imageData = {
        id: imageId,
        originalName: file.originalname,
        originalFormat: originalInfo.format,
        originalSize: file.buffer.length,
        originalWidth: originalInfo.width,
        originalHeight: originalInfo.height,
        currentBuffer: file.buffer,
        currentSize: file.buffer.length,
        currentWidth: originalInfo.width,
        currentHeight: originalInfo.height,
        currentFormat: originalInfo.format,
        filename,
        filepath,
        stage: 'uploaded'
      };
      
      results.push({
        id: imageId,
        originalName: file.originalname,
        originalFormat: originalInfo.format,
        originalSize: file.buffer.length,
        originalWidth: originalInfo.width,
        originalHeight: originalInfo.height,
        currentSize: file.buffer.length,
        currentWidth: originalInfo.width,
        currentHeight: originalInfo.height,
        currentFormat: originalInfo.format,
        filename,
        stage: 'uploaded'
      });
      
      // Store in session
      if (!imageSessions.has(sessionId)) {
        imageSessions.set(sessionId, new Map());
      }
      imageSessions.get(sessionId).set(imageId, imageData);
    }
    
    res.json({ sessionId, images: results });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert images to specified format (AVIF or WebP)
app.post('/api/convert', async (req, res) => {
  try {
    const { sessionId, imageIds, format } = req.body;
    
    if (!['avif', 'webp'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be "avif" or "webp".' });
    }
    
    const session = imageSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const results = [];
    
    for (const imageId of imageIds) {
      const imageData = session.get(imageId);
      if (!imageData) continue;
      
      let convertedBuffer;
      if (format === 'avif') {
        convertedBuffer = await sharp(imageData.currentBuffer)
          .avif({ 
            quality: 80,
            effort: 6,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();
      } else {
        convertedBuffer = await sharp(imageData.currentBuffer)
          .webp({ 
            quality: 80,
            effort: 6
          })
          .toBuffer();
      }
      
      // Compare sizes - keep whichever is smaller
      const convertedIsSmaller = convertedBuffer.length < imageData.currentSize;
      const finalBuffer = convertedIsSmaller ? convertedBuffer : imageData.currentBuffer;
      const finalFormat = convertedIsSmaller ? format : imageData.currentFormat;
      const finalExt = convertedIsSmaller ? format : (imageData.currentFormat === 'jpeg' ? 'jpg' : imageData.currentFormat);
      
      const finalInfo = await getImageInfo(finalBuffer);
      
      // Remove old file if format changed
      const newFilename = `${imageId}.${finalExt}`;
      const newFilepath = path.join(processedDir, newFilename);
      
      if (imageData.filepath !== newFilepath) {
        try {
          await fs.unlink(imageData.filepath);
        } catch (e) {
          // Ignore if file doesn't exist
        }
      }
      
      await fs.writeFile(newFilepath, finalBuffer);
      
      // Update session data
      imageData.currentBuffer = finalBuffer;
      imageData.currentSize = finalBuffer.length;
      imageData.currentWidth = finalInfo.width;
      imageData.currentHeight = finalInfo.height;
      imageData.currentFormat = finalFormat;
      imageData.filename = newFilename;
      imageData.filepath = newFilepath;
      imageData.stage = 'converted';
      imageData.keptOriginal = !convertedIsSmaller;
      imageData.convertedWouldBe = convertedBuffer.length;
      imageData.targetFormat = format;
      
      results.push({
        id: imageId,
        originalName: imageData.originalName,
        originalFormat: imageData.originalFormat,
        originalSize: imageData.originalSize,
        convertedSize: finalBuffer.length,
        convertedWidth: finalInfo.width,
        convertedHeight: finalInfo.height,
        convertedFormat: finalFormat,
        targetFormat: format,
        keptOriginal: !convertedIsSmaller,
        convertedWouldBe: convertedBuffer.length,
        stage: 'converted'
      });
    }
    
    res.json({ images: results });
  } catch (error) {
    console.error('Convert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resize images
app.post('/api/resize', async (req, res) => {
  try {
    const { sessionId, imageIds, preset } = req.body;
    
    const presetMap = {
      '1k': 1000,
      '1.5k': 1500,
      '2k': 2000,
      '3k': 3000
    };
    
    const targetSize = presetMap[preset];
    if (!targetSize) {
      return res.status(400).json({ error: 'Invalid preset' });
    }
    
    const session = imageSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const results = [];
    
    for (const imageId of imageIds) {
      const imageData = session.get(imageId);
      if (!imageData) continue;
      
      const { width, height, skipped } = calculateResizeDimensions(
        imageData.currentWidth,
        imageData.currentHeight,
        targetSize
      );
      
      let resizedBuffer;
      if (skipped) {
        // Image is already smaller than target, keep current
        resizedBuffer = imageData.currentBuffer;
      } else {
        // Resize and encode in the current format
        let sharpInstance = sharp(imageData.currentBuffer).resize(width, height, { fit: 'inside' });
        
        const format = imageData.currentFormat || 'avif';
        if (format === 'avif') {
          sharpInstance = sharpInstance.avif({ quality: 80, effort: 6, chromaSubsampling: '4:4:4' });
        } else if (format === 'webp') {
          sharpInstance = sharpInstance.webp({ quality: 80 });
        } else if (format === 'png') {
          sharpInstance = sharpInstance.png({ quality: 80 });
        } else if (format === 'jpeg' || format === 'jpg') {
          sharpInstance = sharpInstance.jpeg({ quality: 80 });
        } else {
          sharpInstance = sharpInstance.avif({ quality: 80, effort: 6, chromaSubsampling: '4:4:4' });
        }
        
        resizedBuffer = await sharpInstance.toBuffer();
      }
      
      const resizedInfo = await getImageInfo(resizedBuffer);
      
      // Update file on disk
      await fs.writeFile(imageData.filepath, resizedBuffer);
      
      // Update session data
      imageData.currentBuffer = resizedBuffer;
      imageData.currentSize = resizedBuffer.length;
      imageData.currentWidth = resizedInfo.width;
      imageData.currentHeight = resizedInfo.height;
      imageData.stage = 'resized';
      
      results.push({
        id: imageId,
        originalName: imageData.originalName,
        resizedWidth: resizedInfo.width,
        resizedHeight: resizedInfo.height,
        resizedSize: resizedBuffer.length,
        skipped,
        stage: 'resized'
      });
    }
    
    res.json({ images: results });
  } catch (error) {
    console.error('Resize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compress with TinyPNG
app.post('/api/compress', async (req, res) => {
  try {
    const { sessionId, imageIds } = req.body;
    
    const session = imageSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const results = [];
    let compressionCount = null;
    
    for (const imageId of imageIds) {
      const imageData = session.get(imageId);
      if (!imageData) continue;
      
      // Upload to TinyPNG
      const uploadResponse = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('api:' + TINYPNG_API_KEY).toString('base64')
        },
        body: imageData.currentBuffer
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(`TinyPNG error: ${errorData.message}`);
      }
      
      // Get compression count from header
      compressionCount = uploadResponse.headers.get('Compression-Count');
      
      const uploadResult = await uploadResponse.json();
      const outputUrl = uploadResponse.headers.get('Location');
      
      // Determine output format - keep current format
      const currentFormat = imageData.currentFormat || 'png';
      const mimeTypes = {
        'avif': 'image/avif',
        'webp': 'image/webp',
        'png': 'image/png',
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg'
      };
      const outputMime = mimeTypes[currentFormat] || 'image/png';
      
      // Download compressed image in the same format
      const downloadResponse = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('api:' + TINYPNG_API_KEY).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convert: { type: outputMime }
        })
      });
      
      if (!downloadResponse.ok) {
        throw new Error('Failed to download compressed image');
      }
      
      const compressedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
      const compressedInfo = await getImageInfo(compressedBuffer);
      
      // Update filename with correct extension
      const ext = currentFormat === 'jpeg' ? 'jpg' : currentFormat;
      const newFilename = `${imageId}.${ext}`;
      const newFilepath = path.join(processedDir, newFilename);
      
      // Remove old file if different name
      if (imageData.filepath !== newFilepath) {
        try {
          await fs.unlink(imageData.filepath);
        } catch (e) {
          // Ignore if file doesn't exist
        }
      }
      
      // Update file on disk
      await fs.writeFile(newFilepath, compressedBuffer);
      
      // Update session data
      imageData.currentBuffer = compressedBuffer;
      imageData.currentSize = compressedBuffer.length;
      imageData.currentFormat = currentFormat;
      imageData.filename = newFilename;
      imageData.filepath = newFilepath;
      imageData.stage = 'compressed';
      
      results.push({
        id: imageId,
        originalName: imageData.originalName,
        compressedSize: compressedBuffer.length,
        compressedWidth: compressedInfo.width,
        compressedHeight: compressedInfo.height,
        stage: 'compressed'
      });
    }
    
    res.json({ 
      images: results,
      compressionCount: compressionCount ? parseInt(compressionCount) : null
    });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download single image
app.get('/api/download/:sessionId/:imageId', async (req, res) => {
  try {
    const { sessionId, imageId } = req.params;
    
    const session = imageSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const imageData = session.get(imageId);
    if (!imageData) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const originalNameWithoutExt = path.parse(imageData.originalName).name;
    const format = imageData.currentFormat || 'avif';
    const ext = format === 'jpeg' ? 'jpg' : format;
    const downloadName = `${originalNameWithoutExt}.${ext}`;
    
    const mimeTypes = {
      avif: 'image/avif',
      webp: 'image/webp',
      png: 'image/png',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg'
    };
    
    res.setHeader('Content-Type', mimeTypes[format] || 'image/avif');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.send(imageData.currentBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download all as zip
app.get('/api/download-all/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = imageSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="processed-images.zip"');
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    for (const [imageId, imageData] of session) {
      const originalNameWithoutExt = path.parse(imageData.originalName).name;
      const format = imageData.currentFormat || 'avif';
      const ext = format === 'jpeg' ? 'jpg' : format;
      archive.append(imageData.currentBuffer, { name: `${originalNameWithoutExt}.${ext}` });
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('Download all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get compression count (check API status)
app.get('/api/compression-count', async (req, res) => {
  try {
    // Make a minimal request to get the compression count
    // We'll use a tiny 1x1 transparent PNG
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    const response = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('api:' + TINYPNG_API_KEY).toString('base64')
      },
      body: tinyPng
    });
    
    const compressionCount = response.headers.get('Compression-Count');
    
    res.json({ 
      compressionCount: compressionCount ? parseInt(compressionCount) : null,
      monthlyLimit: 500
    });
  } catch (error) {
    console.error('Compression count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old sessions periodically (every hour)
setInterval(async () => {
  // Clear sessions older than 1 hour
  const now = Date.now();
  for (const [sessionId, session] of imageSessions) {
    // In a real app, you'd track creation time
    // For now, just clear all
  }
}, 60 * 60 * 1000);

// Shutdown endpoint - allows UI to stop the server
app.post('/api/shutdown', (req, res) => {
  res.json({ message: 'Server shutting down...' });
  console.log('Shutdown requested, closing server...');
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
