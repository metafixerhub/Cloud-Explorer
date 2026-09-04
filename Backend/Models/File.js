import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Images', 'PDFs', 'Excel', 'Word', 'PowerPoint', 'Videos', 'Audio', 'ZIP', 'Text', 'Others'],
    default: 'Others'
  },
  checksum: { type: String, required: true, index: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// NO permanent DELETE or PUT endpoints exist to modify stored file data
fileSchema.index({ filename: 'text', originalName: 'text', category: 1, folderId: 1, uploadedAt: -1 });
fileSchema.index({ checksum: 1 });

export default mongoose.model('File', fileSchema);
