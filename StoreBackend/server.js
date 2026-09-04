import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { 
  STAGING_DIR, 
  computeSha256, 
  verifyFileSignature, 
  uploadToStorage, 
  getFileStream,
  deleteFromStorage 
} from './storageController.js';

dotenv.config();

const app = express();
const PORT = process.env.STORE_PORT || 5001;

app.use(cors({
  origin: true, 
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer Staging Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STAGING_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueHash = crypto.randomBytes(6).toString('hex');
    cb(null, `upload_${Date.now()}_${uniqueHash}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10000 * 1024 * 1024 // 10 GB limit
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Operational', service: 'Store Backend' });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No upload file stream provided.' });
    }

    const { originalname, size, mimetype, path: tempPath } = req.file;
    const checksum = await computeSha256(tempPath);
    const signature = await verifyFileSignature(tempPath, mimetype);
    const finalMime = signature.mimeType || mimetype || 'application/octet-stream';

    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalname);
    const baseName = path.basename(originalname, ext);
    const storageKey = `${baseName}_${Date.now()}_${uniqueHash}${ext}`;

    await uploadToStorage(tempPath, storageKey, finalMime);

    return res.status(201).json({
      status: 'success',
      storageKey,
      size,
      checksum,
      finalMime,
      originalname
    });
  } catch (err) {
    console.error('Store Upload Error:', err);
    return res.status(500).json({ error: 'File storage failed.' });
  }
});

app.get('/download/:storageKey', async (req, res) => {
  try {
    const { storageKey } = req.params;
    const range = req.headers.range;
    // We assume the frontend passes original name in query to set the attachment filename
    const filename = req.query.filename || storageKey;
    const mimeType = req.query.mimeType || 'application/octet-stream';

    const { stream, contentLength, contentRange, totalSize } = await getFileStream(storageKey, range);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (range && contentRange) {
      res.status(206);
      res.setHeader('Content-Range', contentRange);
      res.setHeader('Content-Length', contentLength);
    } else {
      res.status(200);
      res.setHeader('Content-Length', totalSize);
    }

    stream.pipe(res);
  } catch (err) {
    console.error('Download stream error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/preview/:storageKey', async (req, res) => {
  try {
    const { storageKey } = req.params;
    const range = req.headers.range;
    const filename = req.query.filename || storageKey;
    const mimeType = req.query.mimeType || 'application/octet-stream';

    const { stream, contentLength, contentRange, totalSize } = await getFileStream(storageKey, range);

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (range && contentRange) {
      res.status(206);
      res.setHeader('Content-Range', contentRange);
      res.setHeader('Content-Length', contentLength);
    } else {
      res.status(200);
      res.setHeader('Content-Length', totalSize);
    }

    stream.pipe(res);
  } catch (err) {
    console.error('Preview stream error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/delete', async (req, res) => {
  try {
    const { storageKey } = req.body;
    if (!storageKey) return res.status(400).json({ error: 'No storage key provided' });
    await deleteFromStorage(storageKey);
    return res.status(200).json({ message: 'Deleted from storage' });
  } catch(err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Store Backend active on port ${PORT}`);
});
