import { Router } from 'express';
import { authenticateToken, optionalAuth } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import { 
  register, 
  login, 
  refresh, 
  logout, 
  getProfile, 
  verifyToken 
} from '@controllers/authController';

const router = Router();

// Validation schemas
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'firstName', 'lastName', 'phone', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255
      },
      firstName: {
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      lastName: {
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      phone: {
        type: 'string',
        pattern: '^[+]?[1-9]\\d{1,14}$' // E.164 format
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128
      },
      isVeteran: {
        type: 'boolean'
      }
    },
    additionalProperties: false
  }
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128
      },
      deviceInfo: {
        type: 'object',
        properties: {
          deviceType: { type: 'string' },
          browser: { type: 'string' },
          os: { type: 'string' },
          location: { type: 'string' }
        },
        additionalProperties: true
      }
    },
    additionalProperties: false
  }
};

const refreshSchema = {
  body: {
    type: 'object',
    properties: {
      refreshToken: {
        type: 'string'
      }
    },
    additionalProperties: false
  }
};

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.get('/verify', authenticateToken, verifyToken);

export default router;


