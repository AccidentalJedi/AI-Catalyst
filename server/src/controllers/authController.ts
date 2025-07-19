import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/errorHandler';
import { AuthenticatedRequest, APIResponse } from '../types/index';
import { authenticateUser, refreshAccessToken, logoutUser } from '@services/authService';
import { createUser } from '@services/userService';
import { initializeWizardProgress } from '@services/wizardService';
import { authLogger } from '@utils/logger';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, phone, password, isVeteran } = req.body;
  
  // Validate required fields
  if (!email || !firstName || !lastName || !phone || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // Create user
    const user = await createUser(
      { email, firstName, lastName, phone, password, isVeteran },
      req.ip,
      req.get('User-Agent')
    );
    
    // Initialize wizard progress
    await initializeWizardProgress(user.id, req.ip, req.get('User-Agent'));
    
    // Return success (without password hash)
    const { passwordHash, ...userResponse } = user;
    
    res.status(201).json({
      success: true,
      data: {
        user: userResponse,
        message: 'User registered successfully. Please verify your email address.'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    
    authLogger.error('User registration failed:', {
      error: errorMessage,
      email,
      requestId: req.headers['x-request-id']
    });
    
    res.status(400).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, deviceInfo } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // Authenticate user
    const authResult = await authenticateUser(
      { email, password, deviceInfo },
      req.ip,
      req.get('User-Agent')
    );
    
    // Set secure HTTP-only cookie for refresh token
    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({
      success: true,
      data: {
        user: authResult.user,
        accessToken: authResult.accessToken,
        expiresAt: authResult.expiresAt,
        sessionId: authResult.sessionId
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    
    authLogger.error('User login failed:', {
      error: errorMessage,
      email,
      requestId: req.headers['x-request-id']
    });
    
    res.status(401).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Refresh access token
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    const result = await refreshAccessToken(
      refreshToken,
      req.ip,
      req.get('User-Agent')
    );
    
    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresAt: result.expiresAt
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
    
    authLogger.error('Token refresh failed:', {
      error: errorMessage,
      requestId: req.headers['x-request-id']
    });
    
    res.status(401).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionId) {
      await logoutUser(
        req.sessionId,
        req.user?.id,
        req.ip,
        req.get('User-Agent')
      );
    }
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Logout failed';
    
    authLogger.error('Logout failed:', {
      error: errorMessage,
      userId: req.user?.id,
      sessionId: req.sessionId,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // Return user profile (password hash already excluded)
    const { passwordHash, ...userProfile } = req.user;
    
    res.json({
      success: true,
      data: { user: userProfile },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get profile';
    
    authLogger.error('Get profile failed:', {
      error: errorMessage,
      userId: req.user.id,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Verify token endpoint (for client-side token validation)
 */
export const verifyToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  res.json({
    success: true,
    data: {
      valid: true,
      userId: req.user.id,
      email: req.user.email,
      sessionId: req.sessionId
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id']
  } as APIResponse);
});



