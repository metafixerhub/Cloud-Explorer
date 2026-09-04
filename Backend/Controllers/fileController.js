import File from '../Models/File.js';
import Folder from '../Models/Folder.js';
import AuditLog from '../Models/AuditLog.js';
import { detectCategory } from './categoryDetector.js';
import path from 'path';

/**
 * Handle metadata registration after file is uploaded to StoreBackend
 */
export async function registerFile(req, res) {
  try {
    const { storageKey, size, checksum, finalMime, originalname } = req.body;
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;
    const duplicateAction = req.body.duplicateAction || 'ask';

    if (!storageKey || !originalname) {
      return res.status(400).json({ error: 'Missing required file metadata.' });
    }

    // 1. Duplicate Check
    const existingFile = await File.findOne({ checksum, folderId });
    if (existingFile) {
      if (duplicateAction === 'ask') {
        return res.status(409).json({
          status: 'duplicate_detected',
          message: `File "${existingFile.filename}" with identical contents already exists in this directory.`,
          existingFile: { id: existingFile._id, filename: existingFile.filename, size: existingFile.size },
          checksum
        });
      } else if (duplicateAction === 'cancel') {
        return res.status(200).json({ status: 'cancelled', message: 'Upload cancelled due to duplicate detection.' });
      }
    }

    // 2. Auto-detect category
    const category = detectCategory(originalname, finalMime);

    const ext = path.extname(originalname);
    const baseName = path.basename(originalname, ext);
    let finalFilename = originalname;

    if (existingFile && duplicateAction === 'replace') {
      finalFilename = existingFile.filename;
    } else if (existingFile && duplicateAction === 'keepBoth') {
      finalFilename = `${baseName} (Copy)${ext}`;
    }

    // 3. Save structural metadata in MongoDB Atlas
    const fileDoc = await File.create({
      filename: finalFilename,
      originalName: originalname,
      mimeType: finalMime,
      size,
      storageKey,
      url: `/preview/${storageKey}`, // Now points directly to Store Backend preview (handled on frontend)
      category,
      checksum,
      folderId
    });

    // 4. Log audit trail asynchronously
    AuditLog.create({
      action: 'upload',
      fileId: fileDoc._id,
      details: `Registered ${finalFilename} (${size} bytes, Category: ${category}) via Store Backend`,
      ip: req.ip
    }).catch(err => console.error('Non-critical AuditLog write failed:', err.message));

    return res.status(201).json({
      status: 'success',
      message: 'File metadata secured in personal cloud vault.',
      file: fileDoc
    });
  } catch (err) {
    console.error('File Registration Exception:', err);
    return res.status(500).json({ error: 'File registration failed.' });
  }
}

/**
 * List files with folder filtering, search queries, categories, sorting, and pagination
 */
export async function listFiles(req, res) {
  try {
    const { folderId, category, search, sort = 'uploadedAt', order = 'desc', page = 1, limit = 100 } = req.query;
    const query = {};

    // Folder constraint (default Root is null)
    if (folderId && folderId !== 'null' && folderId !== 'root') {
      query.folderId = folderId;
    } else if (!search && !category) {
      query.folderId = null;
    }

    // Category filter
    if (category && category !== 'All' && category !== 'Folders') {
      query.category = category;
    }

    // Instant search query
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { filename: searchRegex },
        { originalName: searchRegex },
        { mimeType: searchRegex },
        { category: searchRegex }
      ];
    }

    // Sort mapping
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sort] = sortOrder;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [files, totalCount] = await Promise.all([
      File.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit, 10)).populate('folderId', 'name path'),
      File.countDocuments(query)
    ]);

    let folders = [];
    if (!search && (!category || category === 'All' || category === 'Folders')) {
      const folderQuery = { parentFolderId: (folderId && folderId !== 'null' && folderId !== 'root') ? folderId : null };
      folders = await Folder.find(folderQuery).sort({ name: 1 });
    }

    return res.status(200).json({
      files,
      folders,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10),
        pages: Math.ceil(totalCount / parseInt(limit, 10))
      }
    });
  } catch (err) {
    console.error('List Files Error:', err);
    return res.status(500).json({ error: 'Failed to query file directory.' });
  }
}

/**
 * Get file details and generate safe preview metadata
 */
export async function getFileDetails(req, res) {
  try {
    const file = await File.findById(req.params.id).populate('folderId', 'name path');
    if (!file) {
      return res.status(404).json({ error: 'File document not located in directory.' });
    }

    await AuditLog.create({ action: 'preview', fileId: file._id, details: `Inspect metadata for ${file.filename}`, ip: req.ip });

    return res.status(200).json({ file });
  } catch (err) {
    console.error('Get details error:', err);
    return res.status(500).json({ error: 'Failed to read file attributes.' });
  }
}

/**
 * Selective Batch File Deletion for Settings Storage Manager
 */
export async function batchDeleteFiles(req, res) {
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files specified for deletion.' });
    }

    const filesToDelete = await File.find({ _id: { $in: fileIds } });
    if (filesToDelete.length === 0) {
      return res.status(404).json({ error: 'Selected files were not found in database.' });
    }

    let totalDeletedBytes = 0;
    const deletedCount = filesToDelete.length;
    const STORE_BACKEND_URL = process.env.STORE_BACKEND_URL || 'https://cloud-explorer-store.onrender.com';

    // Securely delete each item from vault disk / cloud storage via StoreBackend
    for (const file of filesToDelete) {
      try {
        await fetch(`${STORE_BACKEND_URL}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storageKey: file.storageKey })
        });
        totalDeletedBytes += (file.size || 0);
      } catch (err) {
        console.error(`Warning: Failed to contact StoreBackend to delete storage object ${file.storageKey}:`, err);
      }
    }

    // Remove metadata records from MongoDB
    await File.deleteMany({ _id: { $in: fileIds } });

    // Audit Log record for security transparency
    await AuditLog.create({
      action: 'delete_files',
      details: `Batch deleted ${deletedCount} file(s) freeing ${(totalDeletedBytes / (1024 * 1024)).toFixed(2)} MB of vault storage`,
      ip: req.ip
    });

    return res.status(200).json({
      message: `Successfully deleted ${deletedCount} file(s) and reclaimed ${(totalDeletedBytes / (1024 * 1024)).toFixed(2)} MB of server space!`,
      deletedIds: fileIds,
      freedBytes: totalDeletedBytes
    });
  } catch (err) {
    console.error('Batch delete error:', err);
    return res.status(500).json({ error: 'Failed to complete selective deletion operation.' });
  }
}

