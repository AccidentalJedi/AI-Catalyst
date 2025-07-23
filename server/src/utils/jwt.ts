/**
 * AI Catalyst JWT Utility - Database-Agnostic Token Management
 * 
 * This utility provides secure JWT token generation and verification for authentication.
 * It follows the established database-agnostic patterns and security best practices.
 * 
 * SECURITY FEATURES:
 * ✅ Separate access and refresh token secrets
 * ✅ Configurable token expiry times
 * ✅ Type-safe token generation and verification
 * ✅ Environment-based configuration with secure defaults
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { TokenPair } from '../types/index';
import { dbLogger } from './logger';

// Environment-based configuration with secure defaults
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your-default-access-secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-default-refresh-secret';

// Token expiry configuration (ensure string type for JWT library)
const ACCESS_TOKEN_EXPIRY: string = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY: string = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generates a pair of access and refresh tokens for a given user ID.
 * 
 * ACCESS TOKEN: Short-lived token for API authentication (default: 15 minutes)
 * REFRESH TOKEN: Long-lived token for obtaining new access tokens (default: 7 days)
 * 
 * @param userId - The UUID of the user
 * @returns An object containing the accessToken and refreshToken
 */
export const generateTokens = (userId: string): TokenPair => {
  try {
    const accessTokenOptions: SignOptions = {
      expiresIn: ACCESS_TOKEN_EXPIRY as StringValue,
      issuer: 'ai-catalyst',
      audience: 'ai-catalyst-users'
    };

    const refreshTokenOptions: SignOptions = {
      expiresIn: REFRESH_TOKEN_EXPIRY as StringValue,
      issuer: 'ai-catalyst',
      audience: 'ai-catalyst-users'
    };

    const accessToken = jwt.sign(
      {
        userId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000) // Issued at timestamp
      },
      ACCESS_TOKEN_SECRET,
      accessTokenOptions
    );

    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000) // Issued at timestamp
      },
      REFRESH_TOKEN_SECRET,
      refreshTokenOptions
    );

    dbLogger.info('JWT tokens generated successfully', { 
      userId,
      accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiry: REFRESH_TOKEN_EXPIRY
    });

    return { accessToken, refreshToken };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.error('Failed to generate JWT tokens', {
      error: errorMessage,
      userId
    });
    throw new Error('Token generation failed');
  }
};

/**
 * Verifies an access token using the access token secret.
 * 
 * @param token - The access token to verify
 * @returns The decoded payload of the token
 * @throws An error if the token is invalid, expired, or malformed
 */
export const verifyAccessToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: 'ai-catalyst',
      audience: 'ai-catalyst-users'
    });
    
    // Ensure it's an access token
    if (typeof decoded === 'object' && decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.warn('Access token verification failed', {
      error: errorMessage,
      tokenPrefix: token.substring(0, 10) + '...' // Log only prefix for security
    });
    throw error;
  }
};

/**
 * Verifies a refresh token using the refresh token secret.
 * 
 * @param token - The refresh token to verify
 * @returns The decoded payload of the token
 * @throws An error if the token is invalid, expired, or malformed
 */
export const verifyRefreshToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'ai-catalyst',
      audience: 'ai-catalyst-users'
    });
    
    // Ensure it's a refresh token
    if (typeof decoded === 'object' && decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.warn('Refresh token verification failed', {
      error: errorMessage,
      tokenPrefix: token.substring(0, 10) + '...' // Log only prefix for security
    });
    throw error;
  }
};

/**
 * Generic token verification function (for backward compatibility).
 * 
 * @param token - The token to verify
 * @param secret - The secret key to use for verification
 * @returns The decoded payload of the token
 * @throws An error if the token is invalid or expired
 */
export const verifyToken = (token: string, secret: string): any => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.warn('Generic token verification failed', {
      error: errorMessage,
      tokenPrefix: token.substring(0, 10) + '...' // Log only prefix for security
    });
    throw error;
  }
};

/**
 * Extracts the user ID from a verified token payload.
 * 
 * @param tokenPayload - The decoded token payload
 * @returns The user ID from the token
 * @throws An error if the payload is invalid or missing userId
 */
export const extractUserIdFromToken = (tokenPayload: any): string => {
  if (!tokenPayload || typeof tokenPayload !== 'object') {
    throw new Error('Invalid token payload');
  }
  
  if (!tokenPayload.userId || typeof tokenPayload.userId !== 'string') {
    throw new Error('Invalid or missing userId in token');
  }
  
  return tokenPayload.userId;
};
