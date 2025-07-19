import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { serverConfig, securityConfig } from '@config/index';
import { logger } from '@utils/logger';

// CORS Configuration
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (serverConfig.cors.origin.includes(origin)) {
      return callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: serverConfig.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token'
  ]
});

// Helmet Security Configuration
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.docusign.net", "https://demo.docusign.net"],
      frameSrc: ["'self'", "https://demo.docusign.net"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for DocuSign embedded signing
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Rate Limiting Configuration
const rateLimitMiddleware = rateLimit({
  windowMs: serverConfig.rateLimit.windowMs,
  max: serverConfig.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(serverConfig.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(serverConfig.rateLimit.windowMs / 1000)
    });
  }
});

// Stricter rate limiting for authentication endpoints
const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    });
  }
});

// Request ID middleware for tracking
const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

// Request logging middleware
const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];
  
  logger.info(`${req.method} ${req.url}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
      requestId,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length') || 0
    });
  });

  next();
};

// Security headers middleware
const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Input sanitization middleware
const sanitizeInputMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Basic input sanitization
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Error handling middleware for security
const securityErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Security middleware error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.headers['x-request-id'],
    ip: req.ip,
    url: req.url,
    method: req.method
  });

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId: req.headers['x-request-id']
    });
  } else {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
      requestId: req.headers['x-request-id']
    });
  }
};

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  authRateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityHeadersMiddleware,
  sanitizeInputMiddleware,
  securityErrorHandler
};

// Export individual middleware functions
export {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityHeadersMiddleware,
  sanitizeInputMiddleware,
  securityErrorHandler
};


