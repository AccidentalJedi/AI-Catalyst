/**
 * AI Catalyst AuthService - Database-Agnostic Authentication Implementation
 *
 * This service demonstrates best practices for database-agnostic authentication:
 *
 * KEY PATTERNS IMPLEMENTED:
 * ✅ Universal Parameter Placeholders: Uses ? instead of $1, $2 (PostgreSQL-specific)
 * ✅ JavaScript Date Objects: Uses new Date() instead of database-specific functions
 * ✅ Unified Database Adapter: Leverages DatabaseAdapterFactory for cross-database compatibility
 * ✅ Session Management: Database-agnostic session handling
 * ✅ JWT Token Management: Secure token generation and verification
 * ✅ Comprehensive Audit Logging: All authentication events are logged
 *
 * COMPATIBILITY: Works seamlessly with SQLite (development) and PostgreSQL (production)
 *
 * This service builds upon the UserService template and follows the same database-agnostic principles.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// Import unified database utilities for database-agnostic operations (SQLite/PostgreSQL compatible)
import { unifiedDbUtils as dbUtils } from '@utils/databaseAdapter';
import { logSuccess, logFailure, AuditAction, AuditResource } from '@utils/audit';
import { authLogger } from '@utils/logger';
import { serverConfig } from '@config/index';
import { getUserByEmail, getUserById, updateLastLogin, verifyUserPassword } from './userService';
import { UserEntity, UserSessionEntity } from '../types/index';

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
  deviceInfo?: Record<string, any>;
}

// Authentication result
export interface AuthResult {
  user: Omit<UserEntity, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
}

// Token payload
export interface TokenPayload {
  userId: string;
  sessionId: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
  aud?: string;
}

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  credentials: LoginCredentials,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthResult> => {
  try {
    // Get user by email
    const user = await getUserByEmail(credentials.email);
    if (!user) {
      await logFailure(AuditAction.USER_LOGIN, AuditResource.USER, 'User not found', {
        ipAddress,
        userAgent,
        metadata: { email: credentials.email }
      });
      throw new Error('Invalid credentials');
    }
    
    // Verify password
    const isValidPassword = await verifyUserPassword(user.id, credentials.password);
    if (!isValidPassword) {
      await logFailure(AuditAction.USER_LOGIN, AuditResource.USER, 'Invalid password', {
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { email: credentials.email }
      });
      throw new Error('Invalid credentials');
    }
    
    // Check if user is active
    if (!user.isActive) {
      await logFailure(AuditAction.USER_LOGIN, AuditResource.USER, 'Account inactive', {
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { email: credentials.email }
      });
      throw new Error('Account is inactive');
    }
    
    // Get user roles using database-agnostic query
    const roleResults = await dbUtils.all<{ role: string }>(`
      SELECT role FROM user_roles
      WHERE userId = ? AND isActive = ?
    `, [user.id, true]);
    const roles = roleResults.map(r => r.role);
    
    // Create session
    const sessionResult = await createUserSession(
      user.id,
      credentials.deviceInfo,
      ipAddress,
      userAgent
    );
    
    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      sessionId: sessionResult.sessionId,
      email: user.email,
      roles
    };
    
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    // Update session with token hashes
    await updateSessionTokens(sessionResult.sessionId, accessToken, refreshToken);
    
    // Update user's last login
    await updateLastLogin(user.id);
    
    // Log successful login
    await logSuccess(AuditAction.USER_LOGIN, AuditResource.USER, {
      userId: user.id,
      sessionId: sessionResult.sessionId,
      ipAddress,
      userAgent,
      metadata: { email: user.email, roles }
    });
    
    authLogger.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      sessionId: sessionResult.sessionId,
      roles
    });
    
    // Return auth result (exclude password hash)
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresAt: sessionResult.expiresAt,
      sessionId: sessionResult.sessionId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    authLogger.error('Authentication failed:', {
      error: errorMessage,
      email: credentials.email,
      ipAddress
    });
    
    throw error;
  }
};

/**
 * Create a new user session using database-agnostic patterns
 *
 * DATABASE-AGNOSTIC PATTERNS:
 * - Uses ? parameter placeholders (not PostgreSQL-specific $1, $2)
 * - Uses JavaScript Date objects instead of CURRENT_TIMESTAMP
 * - Removes quoted identifiers for better compatibility
 */
export const createUserSession = async (
  userId: string,
  deviceInfo?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; expiresAt: Date }> => {
  try {
    const sessionId = crypto.randomUUID(); // Database-agnostic UUID generation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const currentTime = new Date(); // JavaScript Date object (database-agnostic)

    // Database-agnostic INSERT using ? placeholders
    await dbUtils.run(`
      INSERT INTO user_sessions (
        id, userId, tokenHash, deviceInfo, ipAddress, userAgent,
        isActive, expiresAt, refreshExpiresAt, lastActivityAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId,
      userId,
      '', // Empty token hash initially
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      ipAddress,
      userAgent,
      true, // isActive
      expiresAt,
      refreshExpiresAt,
      currentTime, // lastActivityAt
      currentTime  // createdAt
    ]);
    
    await logSuccess(AuditAction.SESSION_CREATE, AuditResource.SESSION, {
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { deviceInfo }
    });
    
    return { sessionId, expiresAt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.SESSION_CREATE, AuditResource.SESSION, errorMessage, {
      userId,
      ipAddress,
      userAgent
    });
    
    authLogger.error('Failed to create user session:', {
      error: errorMessage,
      userId
    });
    
    throw new Error('Session creation failed');
  }
};

/**
 * Update session with token hashes using database-agnostic patterns
 */
const updateSessionTokens = async (
  sessionId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const currentTime = new Date(); // JavaScript Date object (database-agnostic)

  // Database-agnostic UPDATE using ? placeholders
  await dbUtils.run(`
    UPDATE user_sessions
    SET tokenHash = ?, refreshTokenHash = ?, lastActivityAt = ?
    WHERE id = ?
  `, [tokenHash, refreshTokenHash, currentTime, sessionId]);
};

/**
 * Generate access token
 */
export const generateAccessToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  const tokenOptions = {
    expiresIn: serverConfig.jwt.expiresIn,
    issuer: 'ai-catalyst',
    audience: 'ai-catalyst-users'
  } as jwt.SignOptions;

  return jwt.sign(payload, serverConfig.jwt.secret, tokenOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, serverConfig.jwt.secret, {
    expiresIn: '7d',
    issuer: 'ai-catalyst',
    audience: 'ai-catalyst-refresh'
  });
};

/**
 * Verify and decode token
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, serverConfig.jwt.secret, {
      issuer: 'ai-catalyst',
      audience: ['ai-catalyst-users', 'ai-catalyst-refresh']
    }) as TokenPayload;
    
    return decoded;
  } catch (error) {
    authLogger.warn('Token verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; expiresAt: Date } | null> => {
  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.aud !== 'ai-catalyst-refresh') {
      throw new Error('Invalid refresh token');
    }
    
    // Check if session exists and is active using database-agnostic query
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const now = new Date(); // JavaScript Date object for comparison
    const session = await dbUtils.get<UserSessionEntity>(`
      SELECT * FROM user_sessions
      WHERE id = ? AND refreshTokenHash = ? AND isActive = ?
      AND refreshExpiresAt > ?
    `, [decoded.sessionId, refreshTokenHash, true, now]);
    
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    // Get user and roles
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }
    
    // Get user roles using database-agnostic query
    const roleResults = await dbUtils.all<{ role: string }>(`
      SELECT role FROM user_roles
      WHERE userId = ? AND isActive = ?
    `, [user.id, true]);
    const roles = roleResults.map(r => r.role);
    
    // Generate new access token
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      sessionId: decoded.sessionId,
      email: user.email,
      roles
    };
    
    const newAccessToken = generateAccessToken(tokenPayload);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Update session with new token hash using database-agnostic patterns
    const newTokenHash = crypto.createHash('sha256').update(newAccessToken).digest('hex');
    const updateTime = new Date(); // JavaScript Date object (database-agnostic)
    await dbUtils.run(`
      UPDATE user_sessions
      SET tokenHash = ?, lastActivityAt = ?
      WHERE id = ?
    `, [newTokenHash, updateTime, decoded.sessionId]);
    
    await logSuccess(AuditAction.TOKEN_REFRESH, AuditResource.SESSION, {
      userId: user.id,
      sessionId: decoded.sessionId,
      ipAddress,
      userAgent
    });
    
    return { accessToken: newAccessToken, expiresAt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.TOKEN_REFRESH, AuditResource.SESSION, errorMessage, {
      ipAddress,
      userAgent
    });
    
    authLogger.error('Token refresh failed:', {
      error: errorMessage,
      ipAddress
    });
    
    return null;
  }
};

/**
 * Logout user (revoke session) using database-agnostic patterns
 */
export const logoutUser = async (
  sessionId: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    const currentTime = new Date(); // JavaScript Date object (database-agnostic)

    // Database-agnostic UPDATE using ? placeholders
    await dbUtils.run(`
      UPDATE user_sessions
      SET isActive = ?, revokedAt = ?, revokedReason = ?
      WHERE id = ?
    `, [false, currentTime, 'user_logout', sessionId]);
    
    await logSuccess(AuditAction.USER_LOGOUT, AuditResource.SESSION, {
      userId,
      sessionId,
      ipAddress,
      userAgent
    });
    
    authLogger.info('User logged out successfully', {
      sessionId,
      userId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.USER_LOGOUT, AuditResource.SESSION, errorMessage, {
      userId,
      sessionId,
      ipAddress,
      userAgent
    });
    
    authLogger.error('Logout failed:', {
      error: errorMessage,
      sessionId,
      userId
    });
  }
};



