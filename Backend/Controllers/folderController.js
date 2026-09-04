import Folder from '../Models/Folder.js';
import File from '../Models/File.js';
import AuditLog from '../Models/AuditLog.js';

/**
 * Create a new folder inside specified parent directory
 */
export async function createFolder(req, res) {
  try {
    const { name, parentFolderId } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Folder name cannot be empty.' });
    }

    let parentPath = 'Home';
    let parentId = null;

    if (parentFolderId && parentFolderId !== 'null' && parentFolderId !== 'root') {
      const parent = await Folder.findById(parentFolderId);
      if (!parent) {
        return res.status(404).json({ error: 'Parent directory not found.' });
      }
      parentPath = parent.path;
      parentId = parent._id;
    }

    const newPath = `${parentPath}/${name.trim()}`;

    // Prevent identical folder name inside same parent
    const existing = await Folder.findOne({ name: name.trim(), parentFolderId: parentId });
    if (existing) {
      return res.status(409).json({ error: `A folder named "${name}" already exists in this location.` });
    }

    const folder = await Folder.create({
      name: name.trim(),
      parentFolderId: parentId,
      path: newPath
    });

    await AuditLog.create({
      action: 'create_folder',
      details: `Created directory ${newPath}`,
      ip: req.ip
    });

    return res.status(201).json({ message: 'Directory created successfully.', folder });
  } catch (err) {
    console.error('Folder Creation Error:', err);
    return res.status(500).json({ error: 'Failed to create directory folder.' });
  }
}

/**
 * Generate Breadcrumb path from target folder up to Home root
 */
export async function getFolderBreadcrumbs(req, res) {
  try {
    const { id } = req.params;
    const breadcrumbs = [{ id: 'root', name: 'Home', path: 'Home' }];

    if (!id || id === 'null' || id === 'root') {
      return res.status(200).json({ breadcrumbs });
    }

    let currentFolder = await Folder.findById(id);
    const trail = [];

    while (currentFolder) {
      trail.unshift({
        id: currentFolder._id.toString(),
        name: currentFolder.name,
        path: currentFolder.path
      });
      if (currentFolder.parentFolderId) {
        currentFolder = await Folder.findById(currentFolder.parentFolderId);
      } else {
        break;
      }
    }

    return res.status(200).json({ breadcrumbs: [...breadcrumbs, ...trail] });
  } catch (err) {
    console.error('Breadcrumbs Error:', err);
    return res.status(500).json({ error: 'Failed to resolve navigation path.' });
  }
}

/**
 * Get dashboard statistical summary (files count, storage size, category breakdown)
 */
export async function getDashboardStats(req, res) {
  try {
    const [totalFiles, foldersCount, categoryStats, sizeStats] = await Promise.all([
      File.countDocuments(),
      Folder.countDocuments(),
      File.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, size: { $sum: '$size' } } }
      ]),
      File.aggregate([
        { $group: { _id: null, totalBytes: { $sum: '$size' } } }
      ])
    ]);

    const totalStorageBytes = sizeStats.length > 0 ? sizeStats[0].totalBytes : 0;

    // Convert aggregate output to accessible dictionary
    const categories = {
      Images: { count: 0, size: 0 },
      PDFs: { count: 0, size: 0 },
      Excel: { count: 0, size: 0 },
      Word: { count: 0, size: 0 },
      PowerPoint: { count: 0, size: 0 },
      Videos: { count: 0, size: 0 },
      Audio: { count: 0, size: 0 },
      ZIP: { count: 0, size: 0 },
      Text: { count: 0, size: 0 },
      Others: { count: 0, size: 0 }
    };

    categoryStats.forEach(stat => {
      if (categories[stat._id]) {
        categories[stat._id] = { count: stat.count, size: stat.size };
      }
    });

    return res.status(200).json({
      totalFiles,
      foldersCount,
      totalStorageBytes,
      categories
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    return res.status(500).json({ error: 'Failed to generate repository metrics.' });
  }
}
