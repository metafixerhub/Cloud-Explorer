import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'system_settings' },
  uploadLimitMb: { type: Number, default: 10000 },
  defaultTheme: { type: String, default: 'simple-white', enum: ['simple-white', 'sleek-dark', 'vibrant-blue'] },
  jwtExpiryHours: { type: Number, default: 24 },
  storageQuotaGb: { type: Number, default: 50 },
  version: { type: String, default: '1.0.0' }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
