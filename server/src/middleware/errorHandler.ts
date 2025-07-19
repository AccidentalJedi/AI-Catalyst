import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'joi';
import { logger } from '@utils/logger';
import { APIResponse } from '../types/index';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationAppError extends AppError {
  public details: any[];

  constructor(message: string, details: any[]) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', service?: string) {
    super(message, 502, `EXTERNAL_SERVICE_ERROR${service ? `_${service.toUpperCase()}` : ''}`);
  }
}

// FinCEN BOI specific errors (2025 Critical)
export class BOIComplianceError extends AppError {
  constructor(message: string = 'BOI compliance error') {
    super(message, 400, 'BOI_COMPLIANCE_ERROR');
  }
}

export class BOIDeadlineError extends AppError {
  constructor(message: string = 'BOI filing deadline exceeded') {
    super(message, 400, 'BOI_DEADLINE_ERROR');
  }
}

// DocuSign specific errors
export class DocuSignError extends AppError {
  constructor(message: string = 'DocuSign integration error') {
    super(message, 502, 'DOCUSIGN_ERROR');
  }
}

// Error response formatter
const formatErrorResponse = (error: Error, requestId?: string): APIResponse => {
  const baseResponse: APIResponse = {
    success: false,
    timestamp: new Date(),
    requestId: requestId || 'unknown'
  };

  if (error instanceof AppError) {
    return {
      ...baseResponse,
      error: error.message,
      code: error.code,
      ...(error instanceof ValidationAppError && { details: error.details })
    };
  }

  if (error instanceof ValidationError) {
    return {
      ...baseResponse,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    };
  }

  // Default error response (don't expose internal errors in production)
  if (process.env.NODE_ENV === 'production') {
    return {
      ...baseResponse,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    };
  } else {
    return {
      ...baseResponse,
      error: error.message,
      code: 'INTERNAL_ERROR',
      stack: error.stack
    };
  }
};

// Main error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string;

  // Log the error
  if (error instanceof AppError && error.isOperational) {
    // Operational errors (expected errors)
    logger.warn('Operational error:', {
      error: error.message,
      statusCode: error.statusCode,
      code: error.code,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });
  } else {
    // Programming errors (unexpected errors)
    logger.error('Programming error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });
  }

  // Send error response
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const errorResponse = formatErrorResponse(error, requestId);

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });

  // Graceful shutdown
  process.exit(1);
};

// Uncaught exception handler
export const handleUncaughtException = (error: Error): void => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });

  // Graceful shutdown
  process.exit(1);
};

// Database error handler
export const handleDatabaseError = (error: any): DatabaseError => {
  logger.error('Database error:', {
    error: error.message,
    code: error.code,
    errno: error.errno
  });

  // Map specific database errors
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new ConflictError('Resource already exists');
  }

  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return new ValidationAppError('Invalid reference to related resource', []);
  }

  if (error.code === 'SQLITE_BUSY') {
    return new DatabaseError('Database is busy, please try again');
  }

  return new DatabaseError(`Database operation failed: ${error.message}`);
};

// External service error handler
export const handleExternalServiceError = (error: any, service: string): ExternalServiceError => {
  logger.error(`${service} service error:`, {
    error: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data
  });

  if (error.response?.status === 401) {
    return new ExternalServiceError(`${service} authentication failed`, service);
  }

  if (error.response?.status === 403) {
    return new ExternalServiceError(`${service} access denied`, service);
  }

  if (error.response?.status === 429) {
    return new ExternalServiceError(`${service} rate limit exceeded`, service);
  }

  if (error.response?.status >= 500) {
    return new ExternalServiceError(`${service} server error`, service);
  }

  return new ExternalServiceError(`${service} integration error: ${error.message}`, service);
};

// FinCEN BOI error handler (2025 Critical)
export const handleBOIError = (error: any): BOIComplianceError | BOIDeadlineError => {
  logger.error('BOI compliance error:', {
    error: error.message,
    stack: error.stack
  });

  if (error.message.includes('deadline')) {
    return new BOIDeadlineError(error.message);
  }

  return new BOIComplianceError(error.message);
};

// DocuSign error handler
export const handleDocuSignError = (error: any): DocuSignError => {
  logger.error('DocuSign error:', {
    error: error.message,
    status: error.response?.status,
    errorCode: error.response?.data?.errorCode,
    message: error.response?.data?.message
  });

  if (error.response?.data?.errorCode === 'AUTHORIZATION_INVALID_TOKEN') {
    return new DocuSignError('DocuSign authentication token is invalid or expired');
  }

  if (error.response?.data?.errorCode === 'ACCOUNT_NOT_AUTHORIZED') {
    return new DocuSignError('DocuSign account is not authorized for this operation');
  }

  return new DocuSignError(`DocuSign integration error: ${error.message}`);
};

// Error monitoring and alerting
export const monitorError = (error: Error, context: any): void => {
  // In production, you might want to send errors to monitoring services
  // like Sentry, DataDog, or custom alerting systems
  
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to monitoring service
    // sentry.captureException(error, { extra: context });
    
    // Example: Send critical alerts
    if (error instanceof DatabaseError || error instanceof BOIDeadlineError) {
      // sendCriticalAlert(error, context);
    }
  }
};


