import express from 'express';
import { authenticateToken, login, changePassword } from '../Controllers/authController.js';
import { registerFile, listFiles, getFileDetails, batchDeleteFiles } from '../Controllers/fileController.js';
import { createFolder, getFolderBreadcrumbs, getDashboardStats } from '../Controllers/folderController.js';
import { getSettings, saveSettings, getAuditLogs } from '../Controllers/settingsController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict Rate Limiting for Login authentication attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // max 10 failed login attempts per window
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' }
});

// ==========================================
// PUBLIC & AUTHENTICATION ENDPOINTS
// ==========================================
router.post('/login', loginLimiter, login);

// ==========================================
// PROTECTED API ENDPOINTS (JWT REQUIREMENT)
// ==========================================
router.use(authenticateToken);

// Dashboard Statistics & Analytics
router.get('/stats', getDashboardStats);

// Folder Architecture & Breadcrumbs
router.post('/folders', createFolder);
router.get('/folders/:id/breadcrumbs', getFolderBreadcrumbs);

// File Exploration & Registration
router.post('/files/register', registerFile);
router.get('/files', listFiles);
router.get('/file/:id', getFileDetails);
router.post('/files/delete', batchDeleteFiles); // Selective batch file deletion for Settings Storage Quota Manager

// Administration Settings & Security Audit Logs
router.get('/settings', getSettings);
router.post('/settings', saveSettings);
router.post('/password', changePassword);
router.get('/audit-logs', getAuditLogs);

export default router;
