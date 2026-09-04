import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Mock models and utilities for standalone execution
const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  category: { type: String, required: true, default: 'Others' },
  checksum: { type: String, required: true, index: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  uploadedAt: { type: Date, default: Date.now }
});
const File = mongoose.model('File', fileSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const UPLOADS_DIR = path.resolve(__dirname, '../Uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function detectCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) return 'Images';
  if (['.mp4', '.avi', '.mkv', '.mov'].includes(ext)) return 'Videos';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return 'Audio';
  if (['.pdf'].includes(ext)) return 'PDFs';
  if (['.doc', '.docx'].includes(ext)) return 'Word';
  if (['.xls', '.xlsx'].includes(ext)) return 'Excel';
  if (['.ppt', '.pptx'].includes(ext)) return 'PowerPoint';
  if (['.zip', '.rar', '.7z'].includes(ext)) return 'ZIP';
  if (['.txt', '.csv', '.json', '.mht', '.html', '.js', '.css'].includes(ext)) return 'Text';
  return 'Others';
}

function computeFastChecksum(filePath) {
  const stats = fs.statSync(filePath);
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
  } else {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
}

async function runImport() {
  console.log('🚀 Starting Automatic Local Workspace File Import...');
  
  // 1. Connect to Database directly
  const MONGODB_URI = 'mongodb+srv://ainmm2024_db_user:AYIzMbtUYOZanLqG@cluster0.1l0g3ug.mongodb.net/?appName=Cluster0';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  // 2. Scan root directory
  const allEntries = fs.readdirSync(ROOT_DIR);
  const filesToImport = allEntries.filter(entry => {
    // Ignore backend/frontend folders, dotfiles, git, etc.
    if (entry === 'Backend' || entry === 'Frontend' || entry === 'node_modules' || entry.startsWith('.') || entry === 'package.json' || entry === 'package-lock.json' || entry === 'README.md') {
      return false;
    }
    const fullPath = path.join(ROOT_DIR, entry);
    return fs.statSync(fullPath).isFile();
  });

  console.log(`📦 Found ${filesToImport.length} local files to import...`);

  let successCount = 0;
  let skipCount = 0;

  // 3. Process all files
  for (const filename of filesToImport) {
    const sourcePath = path.join(ROOT_DIR, filename);
    const stats = fs.statSync(sourcePath);
    
    try {
      const checksum = computeFastChecksum(sourcePath);
      
      // Check if already in DB
      const existingFile = await File.findOne({ checksum });
      if (existingFile) {
        console.log(`⏩ Skipping ${filename} (Already exists in database)`);
        skipCount++;
        continue;
      }

      const ext = path.extname(filename);
      const uniqueHash = crypto.randomBytes(6).toString('hex');
      const storageKey = `import_${Date.now()}_${uniqueHash}${ext}`;
      const destPath = path.join(UPLOADS_DIR, storageKey);

      // Copy file to Backend/Uploads/ (leave original intact for safety, or we could renameSync)
      fs.copyFileSync(sourcePath, destPath);

      const category = detectCategory(filename);
      let mimeType = 'application/octet-stream';
      if (ext === '.jpg') mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.mp4') mimeType = 'video/mp4';
      if (ext === '.pdf') mimeType = 'application/pdf';
      if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      await File.create({
        filename: filename,
        originalName: filename,
        mimeType: mimeType,
        size: stats.size,
        storageKey: storageKey,
        url: `/api/file/download/${storageKey}`,
        category: category,
        checksum: checksum,
        folderId: null
      });

      console.log(`✅ Imported: ${filename} -> Category: ${category}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error importing ${filename}:`, err.message);
    }
  }

  console.log('\n🎉 IMPORT COMPLETE!');
  console.log(`✅ Successfully Imported: ${successCount} files into MongoDB Atlas!`);
  console.log(`⏩ Skipped (Duplicates): ${skipCount} files`);
  console.log('You can now refresh your web browser to see all these files instantly!');
  
  process.exit(0);
}

runImport();
