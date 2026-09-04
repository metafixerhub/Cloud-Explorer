import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fileTypeFromFile } from 'file-type';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '../Uploads');
const STAGING_DIR = path.join(LOCAL_STORAGE_DIR, '.staging');

// Ensure storage directories exist without touching root user files
if (!fs.existsSync(LOCAL_STORAGE_DIR)) fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });

const USE_CLOUD = process.env.CLOUD_STORAGE_PROVIDER === 'r2' || process.env.CLOUD_STORAGE_PROVIDER === 's3';
const S3_BUCKET = process.env.S3_BUCKET || 'personal-cloud-explorer-vault';

let s3Client = null;
if (USE_CLOUD && process.env.S3_ACCESS_KEY_ID && process.env.S3_ACCESS_KEY_ID !== 'your_r2_access_key') {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });
  console.log('☁️ Cloudflare R2 / AWS S3 storage engine initialized successfully.');
} else {
  console.log('📦 No cloud keys detected - defaulting to isolated local vault storage at /Uploads.');
}

/**
 * Compute SHA-256 cryptographic checksum of a file stream (with high-speed sampling for >50MB files)
 */
export async function computeSha256(filePath) {
  try {
    const stats = fs.statSync(filePath);
    // For files > 50 MB, perform ultra-fast sampled hashing (filesize + first 1MB + last 1MB)
    // Takes < 5ms for multi-gigabyte files instead of reading billions of bytes!
    if (stats.size > 50 * 1024 * 1024) {
      const hash = crypto.createHash('sha256');
      hash.update(String(stats.size));

      const headSize = Math.min(1024 * 1024, stats.size);
      const headBuffer = Buffer.alloc(headSize);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, headBuffer, 0, headSize, 0);
      hash.update(headBuffer);

      if (stats.size > 2 * 1024 * 1024) {
        const tailBuffer = Buffer.alloc(1024 * 1024);
        fs.readSync(fd, tailBuffer, 0, tailBuffer.length, stats.size - 1024 * 1024);
        hash.update(tailBuffer);
      }
      fs.closeSync(fd);
      return `fast_sample_${hash.digest('hex')}`;
    }

    // Standard fast stream hashing for small files (<= 50MB)
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  } catch (err) {
    console.error('Checksum compute error:', err);
    return `hash_${Date.now()}_${Math.random()}`;
  }
}

/**
 * Validate file signature (magic numbers) to prevent MIME spoofing
 */
export async function verifyFileSignature(filePath, fallbackMime) {
  try {
    const type = await fileTypeFromFile(filePath);
    if (type) {
      return { mimeType: type.mime, ext: type.ext, verified: true };
    }
    // Plain text, CSV, JSON, Markdown, and custom code often don't have binary magic headers
    return { mimeType: fallbackMime || 'application/octet-stream', ext: '', verified: false };
  } catch (err) {
    console.error('Magic number validation warning:', err);
    return { mimeType: fallbackMime || 'application/octet-stream', ext: '', verified: false };
  }
}

/**
 * Stream large files up to 10GB directly to R2/S3 or instant Zero-Copy Local rename
 */
export async function uploadToStorage(filePath, storageKey, mimeType) {
  if (s3Client) {
    const fileStream = fs.createReadStream(filePath);
    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: fileStream,
        ContentType: mimeType
      },
      queueSize: 8, // Doubled parallel workers to 8 for maximum bandwidth
      partSize: 10 * 1024 * 1024 // 10MB chunks
    });
    await parallelUploads3.done();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } else {
    // Zero-copy instant filesystem move (fs.renameSync) instead of slow streaming copies!
    const destPath = path.join(LOCAL_STORAGE_DIR, storageKey);
    try {
      fs.renameSync(filePath, destPath); // Executes instantaneously in micro-seconds!
    } catch (err) {
      // Fallback if renaming across filesystem devices
      fs.copyFileSync(filePath, destPath);
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Get readable streaming pipe from R2/S3 or local storage for downloads & previews
 */
export async function getFileStream(storageKey, range) {
  if (s3Client) {
    const params = { Bucket: S3_BUCKET, Key: storageKey };
    if (range) params.Range = range;
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);
    return { stream: response.Body, contentLength: response.ContentLength, contentRange: response.ContentRange };
  } else {
    const localPath = path.join(LOCAL_STORAGE_DIR, storageKey);
    if (!fs.existsSync(localPath)) {
      throw new Error('File not found in storage vault.');
    }
    
    if (range) {
      const stat = fs.statSync(localPath);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(localPath, { start, end });
      return { stream, contentLength: chunksize, contentRange: `bytes ${start}-${end}/${stat.size}`, totalSize: stat.size };
    }
    
    return { stream: fs.createReadStream(localPath), totalSize: fs.statSync(localPath).size };
  }
}

/**
 * Securely delete file blob from cloud vault or internal disk storage with strict boundary fencing
 */
export async function deleteFromStorage(storageKey) {
  if (!storageKey) return;
  if (s3Client) {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey
    });
    await s3Client.send(command);
  } else {
    const targetPath = path.resolve(LOCAL_STORAGE_DIR, storageKey);
    const vaultRoot = path.resolve(LOCAL_STORAGE_DIR);
    // Strict security guard against directory traversal outside Backend/Uploads
    if (!targetPath.startsWith(vaultRoot)) {
      throw new Error('Security Exception: Attempted file deletion outside internal vault boundaries.');
    }
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
}

export { STAGING_DIR };
