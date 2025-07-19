import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { serverConfig } from '@config/index';
import { AuthenticatedRequest, UserEntity } from '../types/index';
import { authLogger } from '@utils/logger';

// JWT Authentication Middleware
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      authLogger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        url: req.url,
        requestId: req.headers['x-request-id']
      });
      
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        requestId: req.headers['x-request-id']
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, serverConfig.jwt.secret) as any;
    
    // TODO: In a real implementation, you would fetch the user from the database
    // For now, we'll use the decoded token data
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      phone: decoded.phone,
      createdAt: new Date(decoded.createdAt),
      updatedAt: new Date(decoded.updatedAt),
      isActive: decoded.isActive,
      lastLoginAt: decoded.lastLoginAt ? new Date(decoded.lastLoginAt) : undefined
    } as UserEntity;

    authLogger.info('User authenticated successfully', {
      userId: req.user.id,
      email: req.user.email,
      requestId: req.headers['x-request-id']
    });

    next();
  } catch (error) {
    authLogger.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      url: req.url,
      requestId: req.headers['x-request-id']
    });

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        requestId: req.headers['x-request-id']
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        requestId: req.headers['x-request-id']
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      requestId: req.headers['x-request-id']
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, serverConfig.jwt.secret) as any;
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        phone: decoded.phone,
        createdAt: new Date(decoded.createdAt),
        updatedAt: new Date(decoded.updatedAt),
        isActive: decoded.isActive,
        lastLoginAt: decoded.lastLoginAt ? new Date(decoded.lastLoginAt) : undefined
      } as UserEntity;
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    authLogger.warn('Optional authentication failed, continuing without user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.headers['x-request-id']
    });
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId: req.headers['x-request-id']
      });
    }

    // TODO: Implement role checking when user roles are added to the database
    // For now, all authenticated users have access
    next();
  };
};

// Generate JWT token
export const generateToken = (user: UserEntity): string => {
  const payload = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString()
  };

  const options = {
    expiresIn: serverConfig.jwt.expiresIn,
    issuer: 'ai-catalyst-backend',
    audience: 'ai-catalyst-frontend'
  } as jwt.SignOptions;

  return jwt.sign(payload, serverConfig.jwt.secret, options);
};

// Verify and decode token without middleware
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, serverConfig.jwt.secret);
  } catch (error) {
    throw error;
  }
};

// Refresh token functionality
export const refreshToken = (token: string): string => {
  try {
    const decoded = jwt.verify(token, serverConfig.jwt.secret, { ignoreExpiration: true }) as any;
    
    // Create new token with fresh expiration
    const newPayload = {
      userId: decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      phone: decoded.phone,
      createdAt: decoded.createdAt,
      updatedAt: new Date().toISOString(),
      isActive: decoded.isActive,
      lastLoginAt: new Date().toISOString()
    };

    const refreshOptions = {
      expiresIn: serverConfig.jwt.expiresIn,
      issuer: 'ai-catalyst-backend',
      audience: 'ai-catalyst-frontend'
    } as jwt.SignOptions;

    return jwt.sign(newPayload, serverConfig.jwt.secret, refreshOptions);
  } catch (error) {
    throw new Error('Invalid token for refresh');
  }
};


