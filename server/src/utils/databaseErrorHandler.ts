import { DatabaseError } from 'pg';
import { dbLogger } from '@utils/logger';

// PostgreSQL error codes
export const PostgreSQLErrorCodes = {
  // Connection errors
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08006',
  
  // Authentication errors
  INVALID_AUTHORIZATION_SPECIFICATION: '28000',
  INVALID_PASSWORD: '28P01',
  
  // Syntax errors
  SYNTAX_ERROR: '42601',
  UNDEFINED_COLUMN: '42703',
  UNDEFINED_TABLE: '42P01',
  UNDEFINED_FUNCTION: '42883',
  
  // Constraint violations
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  
  // Data type errors
  INVALID_TEXT_REPRESENTATION: '22P02',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',
  
  // Transaction errors
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  
  // Resource errors
  DISK_FULL: '53100',
  OUT_OF_MEMORY: '53200',
  TOO_MANY_CONNECTIONS: '53300',
  
  // Internal errors
  INTERNAL_ERROR: 'XX000',
  DATA_CORRUPTED: 'XX001'
} as const;

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Database error classification
export interface DatabaseErrorInfo {
  code: string;
  message: string;
  severity: ErrorSeverity;
  isRetryable: boolean;
  userMessage: string;
  suggestedAction: string;
}

// PostgreSQL error classifier
export class PostgreSQLErrorHandler {
  
  // Classify PostgreSQL error
  static classifyError(error: any): DatabaseErrorInfo {
    const pgError = error as DatabaseError;
    const code = pgError.code || 'UNKNOWN';
    const message = pgError.message || 'Unknown database error';
    
    // Default error info
    let errorInfo: DatabaseErrorInfo = {
      code,
      message,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: false,
      userMessage: 'A database error occurred. Please try again.',
      suggestedAction: 'Contact support if the problem persists.'
    };

    // Classify based on error code
    switch (code) {
      // Connection errors - usually retryable
      case PostgreSQLErrorCodes.CONNECTION_EXCEPTION:
      case PostgreSQLErrorCodes.CONNECTION_DOES_NOT_EXIST:
      case PostgreSQLErrorCodes.CONNECTION_FAILURE:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.HIGH,
          isRetryable: true,
          userMessage: 'Database connection error. Please try again in a moment.',
          suggestedAction: 'Check database connectivity and retry the operation.'
        };
        break;

      // Authentication errors - not retryable
      case PostgreSQLErrorCodes.INVALID_AUTHORIZATION_SPECIFICATION:
      case PostgreSQLErrorCodes.INVALID_PASSWORD:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.CRITICAL,
          isRetryable: false,
          userMessage: 'Database authentication failed.',
          suggestedAction: 'Check database credentials and configuration.'
        };
        break;

      // Syntax errors - not retryable, indicates code issue
      case PostgreSQLErrorCodes.SYNTAX_ERROR:
      case PostgreSQLErrorCodes.UNDEFINED_COLUMN:
      case PostgreSQLErrorCodes.UNDEFINED_TABLE:
      case PostgreSQLErrorCodes.UNDEFINED_FUNCTION:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.HIGH,
          isRetryable: false,
          userMessage: 'A system error occurred. Please contact support.',
          suggestedAction: 'Review database schema and query syntax.'
        };
        break;

      // Constraint violations - user data issues
      case PostgreSQLErrorCodes.UNIQUE_VIOLATION:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.LOW,
          isRetryable: false,
          userMessage: 'This record already exists. Please use different values.',
          suggestedAction: 'Check for duplicate data and modify input.'
        };
        break;

      case PostgreSQLErrorCodes.FOREIGN_KEY_VIOLATION:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.MEDIUM,
          isRetryable: false,
          userMessage: 'Referenced record not found. Please check your data.',
          suggestedAction: 'Ensure referenced records exist before creating relationships.'
        };
        break;

      case PostgreSQLErrorCodes.NOT_NULL_VIOLATION:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.LOW,
          isRetryable: false,
          userMessage: 'Required field is missing. Please provide all required information.',
          suggestedAction: 'Check for missing required fields in the request.'
        };
        break;

      case PostgreSQLErrorCodes.CHECK_VIOLATION:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.LOW,
          isRetryable: false,
          userMessage: 'Invalid data provided. Please check your input.',
          suggestedAction: 'Validate input data against business rules.'
        };
        break;

      // Data type errors
      case PostgreSQLErrorCodes.INVALID_TEXT_REPRESENTATION:
      case PostgreSQLErrorCodes.NUMERIC_VALUE_OUT_OF_RANGE:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.LOW,
          isRetryable: false,
          userMessage: 'Invalid data format. Please check your input.',
          suggestedAction: 'Validate data types and formats before submission.'
        };
        break;

      // Transaction errors - usually retryable
      case PostgreSQLErrorCodes.SERIALIZATION_FAILURE:
      case PostgreSQLErrorCodes.DEADLOCK_DETECTED:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.MEDIUM,
          isRetryable: true,
          userMessage: 'Transaction conflict occurred. Please try again.',
          suggestedAction: 'Retry the operation after a brief delay.'
        };
        break;

      // Resource errors - critical
      case PostgreSQLErrorCodes.DISK_FULL:
      case PostgreSQLErrorCodes.OUT_OF_MEMORY:
      case PostgreSQLErrorCodes.TOO_MANY_CONNECTIONS:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.CRITICAL,
          isRetryable: true,
          userMessage: 'System resources are temporarily unavailable. Please try again later.',
          suggestedAction: 'Check system resources and scale if necessary.'
        };
        break;

      // Internal errors - critical
      case PostgreSQLErrorCodes.INTERNAL_ERROR:
      case PostgreSQLErrorCodes.DATA_CORRUPTED:
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.CRITICAL,
          isRetryable: false,
          userMessage: 'A serious system error occurred. Please contact support immediately.',
          suggestedAction: 'Investigate database integrity and restore from backup if necessary.'
        };
        break;

      default:
        // Unknown error code
        errorInfo = {
          ...errorInfo,
          severity: ErrorSeverity.MEDIUM,
          isRetryable: false,
          userMessage: 'An unexpected error occurred. Please try again or contact support.',
          suggestedAction: 'Log the error details and investigate the root cause.'
        };
    }

    return errorInfo;
  }

  // Handle and log PostgreSQL error
  static handleError(error: any, context?: string): DatabaseErrorInfo {
    const errorInfo = this.classifyError(error);
    
    // Log error with appropriate level
    const logContext = {
      code: errorInfo.code,
      message: errorInfo.message,
      severity: errorInfo.severity,
      isRetryable: errorInfo.isRetryable,
      context: context || 'Unknown',
      detail: (error as DatabaseError).detail,
      hint: (error as DatabaseError).hint,
      position: (error as DatabaseError).position,
      internalPosition: (error as DatabaseError).internalPosition,
      internalQuery: (error as DatabaseError).internalQuery,
      where: (error as DatabaseError).where,
      schema: (error as DatabaseError).schema,
      table: (error as DatabaseError).table,
      column: (error as DatabaseError).column,
      dataType: (error as DatabaseError).dataType,
      constraint: (error as DatabaseError).constraint
    };

    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        dbLogger.error('Critical PostgreSQL error:', logContext);
        break;
      case ErrorSeverity.HIGH:
        dbLogger.error('High severity PostgreSQL error:', logContext);
        break;
      case ErrorSeverity.MEDIUM:
        dbLogger.warn('Medium severity PostgreSQL error:', logContext);
        break;
      case ErrorSeverity.LOW:
        dbLogger.info('Low severity PostgreSQL error:', logContext);
        break;
    }

    return errorInfo;
  }

  // Check if error is retryable
  static isRetryableError(error: any): boolean {
    const errorInfo = this.classifyError(error);
    return errorInfo.isRetryable;
  }

  // Get user-friendly error message
  static getUserMessage(error: any): string {
    const errorInfo = this.classifyError(error);
    return errorInfo.userMessage;
  }

  // Get suggested action for error
  static getSuggestedAction(error: any): string {
    const errorInfo = this.classifyError(error);
    return errorInfo.suggestedAction;
  }
}

// Generic database error handler that works with both SQLite and PostgreSQL
export class DatabaseErrorHandler {
  
  static handleError(error: any, context?: string): DatabaseErrorInfo {
    // Check if it's a PostgreSQL error
    if (error.code && typeof error.code === 'string') {
      return PostgreSQLErrorHandler.handleError(error, context);
    }
    
    // Handle SQLite or other database errors
    const message = error.message || 'Unknown database error';
    
    // Basic SQLite error classification
    let severity = ErrorSeverity.MEDIUM;
    let isRetryable = false;
    let userMessage = 'A database error occurred. Please try again.';
    let suggestedAction = 'Contact support if the problem persists.';
    
    if (message.includes('UNIQUE constraint failed')) {
      severity = ErrorSeverity.LOW;
      userMessage = 'This record already exists. Please use different values.';
      suggestedAction = 'Check for duplicate data and modify input.';
    } else if (message.includes('NOT NULL constraint failed')) {
      severity = ErrorSeverity.LOW;
      userMessage = 'Required field is missing. Please provide all required information.';
      suggestedAction = 'Check for missing required fields in the request.';
    } else if (message.includes('database is locked')) {
      severity = ErrorSeverity.MEDIUM;
      isRetryable = true;
      userMessage = 'Database is temporarily busy. Please try again.';
      suggestedAction = 'Retry the operation after a brief delay.';
    }
    
    const errorInfo: DatabaseErrorInfo = {
      code: 'SQLITE_ERROR',
      message,
      severity,
      isRetryable,
      userMessage,
      suggestedAction
    };
    
    // Log the error
    dbLogger.error('SQLite database error:', {
      message: errorInfo.message,
      severity: errorInfo.severity,
      isRetryable: errorInfo.isRetryable,
      context: context || 'Unknown'
    });
    
    return errorInfo;
  }
}

export { PostgreSQLErrorHandler };
