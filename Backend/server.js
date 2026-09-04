import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import apiRouter from './Routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/personal_cloud_explorer';

// Security Middleware (Helmet with custom CSP allowing modern dynamic styling and UI frames)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      mediaSrc: ["'self'", "data:", "blob:", "*"],
      frameSrc: ["'self'", "data:", "blob:"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration with credential support for React + Vite Frontend
app.use(cors({
  origin: true, // Dynamically permit deployed Vercel domains & localhost clients
  credentials: true,
  methods: ['GET', 'POST'], // NO DELETE or PUT allowed per zero-deletion security mandate
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev')); // Structured request audit trail

// Mount APIs under /api prefix
app.use('/api', apiRouter);

// Root health diagnostic check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Operational', service: 'Personal Cloud File Explorer API', timestamp: new Date() });
});

// Database Initialization and Service Launch
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('📊 MongoDB Atlas connected successfully for robust metadata indexing.');
    app.listen(PORT, () => {
      console.log(`🚀 Personal Cloud Explorer backend server active on port ${PORT}`);
      console.log(`🛡️ Strict safety mode enabled: Deletion and destructive endpoints are disabled.`);
    });
  })
  .catch((err) => {
    console.warn('⚠️ MongoDB Connection Notice:', err.message);
    console.warn('🔌 Launching backend in resilient standby mode for UI development & testing...');
    app.listen(PORT, () => {
      console.log(`🚀 Personal Cloud Explorer standby server running on port ${PORT}`);
    });
  });

export default app;
