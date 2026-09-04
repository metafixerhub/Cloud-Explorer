import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, enum: ['upload', 'download', 'preview', 'login', 'create_folder'] },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
  details: { type: String, default: '' },
  ip: { type: String, default: '127.0.0.1' },
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
