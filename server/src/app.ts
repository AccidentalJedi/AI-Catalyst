import express, { json, urlencoded } from 'express';
import path from 'path';
import fs from 'fs';

// Import middleware
import {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityHeadersMiddleware,
  sanitizeInputMiddleware,
  securityErrorHandler
} from '@middleware/security';

import {
  errorHandler,
  notFoundHandler,
  asyncHandler
} from '@middleware/errorHandler';

// Import configuration and logging
import config from '@config/index';
import { logger } from '@utils/logger';

// Import database utilities
import { initializeDatabase } from '@utils/database';
import { initializeSchema } from '@models/schema';

// Import services
import { DocumentGenerationService } from '@services/documentGenerationService';

// Import routes
import routes from '@routes/index';

// Create Express application
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Create necessary directories
const createDirectories = () => {
  const directories = [
    config.upload.uploadDir,
    path.join(process.cwd(), 'logs'), // Use simple logs directory
    path.dirname(config.database.filename)
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Initialize directories
createDirectories();

// Initialize database
try {
  initializeDatabase();
  initializeSchema();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database:', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  process.exit(1);
}

// Initialize services
(async () => {
  try {
    await DocumentGenerationService.initialize();
    logger.info('Document generation service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize document generation service:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Don't exit - service can still run without document generation
  }
})();

// Security middleware (order matters!)
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(securityHeadersMiddleware);
app.use(rateLimitMiddleware);

// Body parsing middleware
app.use(json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Input sanitization
app.use(sanitizeInputMiddleware);

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.app.version,
    environment: config.app.environment,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.headers['x-request-id']
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'AI Catalyst Launch Wizard API is running',
    version: config.app.version,
    environment: config.app.environment,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
});

// Mount API routes
app.use('/', routes);

// Serve static files in production
if (config.app.environment === 'production') {
  const staticPath = path.join(__dirname, '../../dist');
  app.use(express.static(staticPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(staticPath, 'index.html'));
    } else {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        requestId: req.headers['x-request-id']
      });
    }
  });
}

// 404 handler for all routes
app.use(notFoundHandler);

// Global error handlers (order matters!)
app.use(errorHandler);
app.use(securityErrorHandler);

module.exports = app;


