import Settings from '../Models/Settings.js';
import AuditLog from '../Models/AuditLog.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fetch system parameters and settings
 */
export async function getSettings(req, res) {
  try {
    let settings = await Settings.findOne({ key: 'system_settings' });
    if (!settings) {
      settings = await Settings.create({
        key: 'system_settings',
        uploadLimitMb: parseInt(process.env.UPLOAD_LIMIT_MB || '10000', 10),
        defaultTheme: 'simple-white',
        jwtExpiryHours: parseInt(process.env.JWT_EXPIRY_HOURS || '24', 10),
        storageQuotaGb: 50
      });
    }
    return res.status(200).json({ settings });
  } catch (err) {
    console.error('Get Settings Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve system settings.' });
  }
}

/**
 * Save updated user preferences
 */
export async function saveSettings(req, res) {
  try {
    const { uploadLimitMb, defaultTheme, jwtExpiryHours, storageQuotaGb } = req.body;
    let settings = await Settings.findOne({ key: 'system_settings' });

    if (!settings) {
      settings = new Settings({ key: 'system_settings' });
    }

    if (uploadLimitMb !== undefined) settings.uploadLimitMb = uploadLimitMb;
    if (defaultTheme !== undefined) settings.defaultTheme = defaultTheme;
    if (jwtExpiryHours !== undefined) settings.jwtExpiryHours = jwtExpiryHours;
    if (storageQuotaGb !== undefined) settings.storageQuotaGb = storageQuotaGb;

    await settings.save();

    await AuditLog.create({
      action: 'login', // Classified as admin configuration activity
      details: `Updated system settings (Theme: ${settings.defaultTheme}, Limit: ${settings.uploadLimitMb}MB)`,
      ip: req.ip
    });

    return res.status(200).json({ message: 'System preferences saved successfully!', settings });
  } catch (err) {
    console.error('Save Settings Error:', err);
    return res.status(500).json({ error: 'Failed to commit preference changes.' });
  }
}

/**
 * Get recent system security audit logs
 */
export async function getAuditLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(limit).populate('fileId', 'filename size');
    return res.status(200).json({ logs });
  } catch (err) {
    console.error('Get Audit Logs Error:', err);
    return res.status(500).json({ error: 'Could not fetch activity audit trail.' });
  }
}
