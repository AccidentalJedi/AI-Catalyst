import { dbUtils } from '@utils/database';
import { dbLogger } from '@utils/logger';
import crypto from 'crypto';

// Audit log entry interface
export interface AuditLogEntry {
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// Audit actions enum for consistency
export enum AuditAction {
  // User actions
  USER_REGISTER = 'user.register',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_PASSWORD_CHANGE = 'user.password_change',
  USER_EMAIL_VERIFY = 'user.email_verify',
  
  // Authentication actions
  TOKEN_GENERATE = 'auth.token_generate',
  TOKEN_REFRESH = 'auth.token_refresh',
  TOKEN_REVOKE = 'auth.token_revoke',
  SESSION_CREATE = 'auth.session_create',
  SESSION_EXPIRE = 'auth.session_expire',
  
  // Company/Business actions
  COMPANY_CREATE = 'company.create',
  COMPANY_UPDATE = 'company.update',
  COMPANY_DELETE = 'company.delete',
  COMPANY_STATUS_CHANGE = 'company.status_change',
  
  // Document actions
  DOCUMENT_CREATE = 'document.create',
  DOCUMENT_UPDATE = 'document.update',
  DOCUMENT_DELETE = 'document.delete',
  DOCUMENT_SIGN = 'document.sign',
  DOCUMENT_DOWNLOAD = 'document.download',
  
  // BOI Compliance actions
  BOI_CREATE = 'boi.create',
  BOI_UPDATE = 'boi.update',
  BOI_SUBMIT = 'boi.submit',
  BOI_APPROVE = 'boi.approve',
  BOI_REJECT = 'boi.reject',
  
  // Wizard actions
  WIZARD_START = 'wizard.start',
  WIZARD_STEP_COMPLETE = 'wizard.step_complete',
  WIZARD_STEP_SKIP = 'wizard.step_skip',
  WIZARD_COMPLETE = 'wizard.complete',
  
  // Admin actions
  ADMIN_USER_ROLE_CHANGE = 'admin.user_role_change',
  ADMIN_SYSTEM_CONFIG = 'admin.system_config',
  ADMIN_DATA_EXPORT = 'admin.data_export',
  
  // Security actions
  SECURITY_LOGIN_FAILED = 'security.login_failed',
  SECURITY_ACCOUNT_LOCKED = 'security.account_locked',
  SECURITY_SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  SECURITY_DATA_BREACH_ATTEMPT = 'security.data_breach_attempt'
}

// Resource types enum
export enum AuditResource {
  USER = 'user',
  SESSION = 'session',
  COMPANY = 'company',
  DOCUMENT = 'document',
  BOI_COMPLIANCE = 'boi_compliance',
  BENEFICIAL_OWNER = 'beneficial_owner',
  WIZARD_PROGRESS = 'wizard_progress',
  SYSTEM = 'system'
}

/**
 * Log an audit event
 */
export const logAuditEvent = async (entry: AuditLogEntry): Promise<void> => {
  try {
    const auditId = crypto.randomUUID();
    
    // Sanitize and prepare data for storage
    const sanitizedEntry = {
      id: auditId,
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      success: entry.success ? 1 : 0,
      errorMessage: entry.errorMessage || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      timestamp: new Date().toISOString()
    };
    
    // Insert audit log entry
    dbUtils.run(`
      INSERT INTO audit_logs (
        id, userId, sessionId, action, resource, resourceId,
        oldValues, newValues, ipAddress, userAgent, success,
        errorMessage, metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sanitizedEntry.id,
      sanitizedEntry.userId,
      sanitizedEntry.sessionId,
      sanitizedEntry.action,
      sanitizedEntry.resource,
      sanitizedEntry.resourceId,
      sanitizedEntry.oldValues,
      sanitizedEntry.newValues,
      sanitizedEntry.ipAddress,
      sanitizedEntry.userAgent,
      sanitizedEntry.success,
      sanitizedEntry.errorMessage,
      sanitizedEntry.metadata,
      sanitizedEntry.timestamp
    ]);
    
    // Log to application logger for immediate visibility
    if (entry.success) {
      dbLogger.info('Audit event logged:', {
        action: entry.action,
        resource: entry.resource,
        userId: entry.userId,
        auditId
      });
    } else {
      dbLogger.warn('Failed action audit event:', {
        action: entry.action,
        resource: entry.resource,
        userId: entry.userId,
        error: entry.errorMessage,
        auditId
      });
    }
  } catch (error) {
    // Critical: audit logging failure should be logged but not throw
    dbLogger.error('Failed to log audit event:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      originalAction: entry.action,
      originalResource: entry.resource
    });
  }
};

/**
 * Log successful action
 */
export const logSuccess = async (
  action: AuditAction,
  resource: AuditResource,
  options: Partial<AuditLogEntry> = {}
): Promise<void> => {
  await logAuditEvent({
    ...options,
    action,
    resource,
    success: true
  });
};

/**
 * Log failed action
 */
export const logFailure = async (
  action: AuditAction,
  resource: AuditResource,
  errorMessage: string,
  options: Partial<AuditLogEntry> = {}
): Promise<void> => {
  await logAuditEvent({
    ...options,
    action,
    resource,
    success: false,
    errorMessage
  });
};

/**
 * Log data change with before/after values
 */
export const logDataChange = async (
  action: AuditAction,
  resource: AuditResource,
  resourceId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  options: Partial<AuditLogEntry> = {}
): Promise<void> => {
  await logAuditEvent({
    ...options,
    action,
    resource,
    resourceId,
    oldValues,
    newValues,
    success: true
  });
};

/**
 * Get audit logs for a specific user
 */
export const getUserAuditLogs = (
  userId: string,
  limit: number = 100,
  offset: number = 0
): any[] => {
  return dbUtils.all(`
    SELECT * FROM audit_logs 
    WHERE userId = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `, [userId, limit, offset]);
};

/**
 * Get audit logs for a specific resource
 */
export const getResourceAuditLogs = (
  resource: string,
  resourceId: string,
  limit: number = 100,
  offset: number = 0
): any[] => {
  return dbUtils.all(`
    SELECT * FROM audit_logs 
    WHERE resource = ? AND resourceId = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `, [resource, resourceId, limit, offset]);
};

/**
 * Get failed audit logs for security monitoring
 */
export const getFailedAuditLogs = (
  hours: number = 24,
  limit: number = 100
): any[] => {
  return dbUtils.all(`
    SELECT * FROM audit_logs 
    WHERE success = 0 
    AND timestamp > datetime('now', '-${hours} hours')
    ORDER BY timestamp DESC 
    LIMIT ?
  `, [limit]);
};

/**
 * Get suspicious activity patterns
 */
export const getSuspiciousActivity = (
  hours: number = 24
): any[] => {
  return dbUtils.all(`
    SELECT 
      ipAddress,
      COUNT(*) as failedAttempts,
      COUNT(DISTINCT userId) as affectedUsers,
      MIN(timestamp) as firstAttempt,
      MAX(timestamp) as lastAttempt
    FROM audit_logs 
    WHERE success = 0 
    AND timestamp > datetime('now', '-${hours} hours')
    AND action LIKE '%login%' OR action LIKE '%security%'
    GROUP BY ipAddress
    HAVING failedAttempts > 5
    ORDER BY failedAttempts DESC
  `);
};

/**
 * Clean up old audit logs (data retention)
 */
export const cleanupOldAuditLogs = (retentionDays: number = 2555): number => { // 7 years default
  try {
    const result = dbUtils.run(`
      DELETE FROM audit_logs 
      WHERE timestamp < datetime('now', '-${retentionDays} days')
    `);
    
    dbLogger.info(`Cleaned up ${result.changes} old audit log entries`, {
      retentionDays,
      deletedCount: result.changes
    });
    
    return result.changes || 0;
  } catch (error) {
    dbLogger.error('Failed to cleanup old audit logs:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      retentionDays
    });
    return 0;
  }
};


