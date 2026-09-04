import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../Models/User.js';
import AuditLog from '../Models/AuditLog.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretJwtKeyForPersonalCloudExplorer2026';
const JWT_EXPIRY_HOURS = parseInt(process.env.JWT_EXPIRY_HOURS || '24', 10);

/**
 * Middleware to authenticate requests via HTTP-Only JWT Cookie or Authorization Bearer header
 */
export async function authenticateToken(req, res, next) {
  let token = req.cookies?.jwt_token;

  // Fallback to Authorization header if cookie is absent
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // Final fallback for <video> streams and direct <a> downloads that cannot send headers or third-party cookies
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login to access your personal cloud vault.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}

/**
 * Handle password-only authentication
 */
export async function login(req, res) {
  const { password } = req.body;
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

  if (!password) {
    return res.status(400).json({ error: 'Password is required to enter.' });
  }

  try {
    let adminUser = await User.findOne({ username: 'admin' });

    // Seed admin user on initial boot if no users exist in database
    if (!adminUser) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'ATHARJAHAN';
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(defaultPassword, salt);
      adminUser = await User.create({ username: 'admin', passwordHash });
      console.log('🌱 Seeded default administrator account with ADMIN_PASSWORD');
    }

    const isValid = await adminUser.verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Wrong password - please check your credential and try again.' });
    }

    // Generate JWT token
    const token = jwt.sign({ username: adminUser.username, role: adminUser.role }, JWT_SECRET, {
      expiresIn: `${JWT_EXPIRY_HOURS}h`
    });

    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Log security event
    await AuditLog.create({ action: 'login', details: 'Successful master password authentication', ip });

    // Set secure HTTP-only cookie compatible with cross-domain Vercel <-> Render setups
    res.cookie('jwt_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: JWT_EXPIRY_HOURS * 3600 * 1000
    });

    return res.status(200).json({
      message: 'Welcome to your Personal Cloud Explorer!',
      token, // Returned for client-side Authorization fallback in desktop/cross-domain setups
      user: { username: adminUser.username, role: adminUser.role, lastLogin: adminUser.lastLogin }
    });
  } catch (err) {
    console.error('Login Error:', err);
    if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && (err.message.includes('buffering timed out') || err.message.includes('failed to connect')))) {
      return res.status(503).json({ error: 'Database connection error. Please ensure your MongoDB Atlas IP Access List is set to 0.0.0.0/0 (Allow access from anywhere).' });
    }
    return res.status(500).json({ error: `Authentication service exception: ${err.message || 'Internal error'}` });
  }
}

/**
 * Handle password modification
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new password are required.' });
  }

  try {
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      return res.status(404).json({ error: 'Administrator user not found.' });
    }

    const isValid = await adminUser.verifyPassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password incorrect.' });
    }

    const salt = await bcrypt.genSalt(12);
    adminUser.passwordHash = await bcrypt.hash(newPassword, salt);
    await adminUser.save();

    await AuditLog.create({ action: 'login', details: 'Master password modified by user', ip: req.ip });

    return res.status(200).json({ message: 'Master password updated successfully!' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
}
