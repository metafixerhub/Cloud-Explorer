import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  path: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

folderSchema.index({ parentFolderId: 1, name: 1 });

export default mongoose.model('Folder', folderSchema);
