import crypto from 'crypto';
import { dbUtils, transaction } from '@utils/databaseAdapter';
import { logSuccess, logFailure, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger } from '@utils/logger';

// Sync operation types
export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SYNC = 'sync'
}

// Sync status
export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// Sync record interface
export interface SyncRecord {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  status: SyncStatus;
  externalSystem: string;
  externalId?: string;
  payload: Record<string, any>;
  response?: Record<string, any>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Sync handler interface
export interface SyncHandler {
  entityType: string;
  externalSystem: string;
  handler: (record: SyncRecord) => Promise<{ success: boolean; externalId?: string; response?: any; error?: string }>;
}

// Registered sync handlers
const syncHandlers = new Map<string, SyncHandler['handler']>();

/**
 * Register a sync handler
 */
export const registerSyncHandler = (
  entityType: string,
  externalSystem: string,
  handler: SyncHandler['handler']
): void => {
  const key = `${entityType}:${externalSystem}`;
  syncHandlers.set(key, handler);
  dbLogger.info('Sync handler registered', { entityType, externalSystem });
};

/**
 * Create sync record
 */
export const createSyncRecord = async (
  entityType: string,
  entityId: string,
  operation: SyncOperation,
  externalSystem: string,
  payload: Record<string, any>,
  maxRetries: number = 3
): Promise<string> => {
  try {
    const syncId = crypto.randomUUID();
    
    // Create sync record in database (we'll need to add this table to schema)
    dbUtils.run(`
      INSERT INTO sync_records (
        id, entityType, entityId, operation, status, externalSystem,
        payload, retryCount, maxRetries, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      syncId,
      entityType,
      entityId,
      operation,
      SyncStatus.PENDING,
      externalSystem,
      JSON.stringify(payload),
      maxRetries
    ]);
    
    dbLogger.info('Sync record created', {
      syncId,
      entityType,
      entityId,
      operation,
      externalSystem
    });
    
    return syncId;
  } catch (error) {
    dbLogger.error('Failed to create sync record:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityType,
      entityId,
      operation,
      externalSystem
    });
    throw error;
  }
};

/**
 * Process pending sync records
 */
export const processPendingSyncs = async (): Promise<number> => {
  try {
    // Get pending sync records
    const pendingRecords = await dbUtils.all<any>(`
      SELECT * FROM sync_records
      WHERE status IN ('pending', 'retrying')
      AND (nextRetryAt IS NULL OR nextRetryAt <= CURRENT_TIMESTAMP)
      ORDER BY createdAt ASC
      LIMIT 50
    `);
    
    let processedCount = 0;
    
    for (const record of pendingRecords) {
      try {
        await processSyncRecord(record);
        processedCount++;
      } catch (error) {
        dbLogger.error('Failed to process sync record:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          syncId: record.id
        });
      }
    }
    
    if (processedCount > 0) {
      dbLogger.info('Processed sync records', { processedCount });
    }
    
    return processedCount;
  } catch (error) {
    dbLogger.error('Failed to process pending syncs:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
};

/**
 * Process individual sync record
 */
const processSyncRecord = async (record: any): Promise<void> => {
  const syncRecord: SyncRecord = {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    operation: record.operation as SyncOperation,
    status: record.status as SyncStatus,
    externalSystem: record.externalSystem,
    externalId: record.externalId,
    payload: JSON.parse(record.payload),
    response: record.response ? JSON.parse(record.response) : undefined,
    error: record.error,
    retryCount: record.retryCount,
    maxRetries: record.maxRetries,
    nextRetryAt: record.nextRetryAt ? new Date(record.nextRetryAt) : undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined
  };
  
  // Update status to in_progress
  dbUtils.run(`
    UPDATE sync_records 
    SET status = 'in_progress', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [syncRecord.id]);
  
  try {
    // Find and execute handler
    const handlerKey = `${syncRecord.entityType}:${syncRecord.externalSystem}`;
    const handler = syncHandlers.get(handlerKey);
    
    if (!handler) {
      throw new Error(`No sync handler found for ${handlerKey}`);
    }
    
    // Execute sync operation
    const result = await handler(syncRecord);
    
    if (result.success) {
      // Update record as completed
      dbUtils.run(`
        UPDATE sync_records 
        SET status = 'completed', externalId = ?, response = ?, 
            completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        result.externalId || null,
        result.response ? JSON.stringify(result.response) : null,
        syncRecord.id
      ]);
      
      await logSuccess(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.SYSTEM, {
        metadata: {
          syncId: syncRecord.id,
          entityType: syncRecord.entityType,
          operation: syncRecord.operation,
          externalSystem: syncRecord.externalSystem
        }
      });
      
      dbLogger.info('Sync completed successfully', {
        syncId: syncRecord.id,
        entityType: syncRecord.entityType,
        externalSystem: syncRecord.externalSystem,
        externalId: result.externalId
      });
    } else {
      throw new Error(result.error || 'Sync operation failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = syncRecord.retryCount + 1;
    
    if (newRetryCount >= syncRecord.maxRetries) {
      // Mark as failed
      dbUtils.run(`
        UPDATE sync_records 
        SET status = 'failed', error = ?, retryCount = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [errorMessage, newRetryCount, syncRecord.id]);
      
      await logFailure(AuditAction.WIZARD_STEP_COMPLETE, AuditResource.SYSTEM, errorMessage, {
        metadata: {
          syncId: syncRecord.id,
          entityType: syncRecord.entityType,
          operation: syncRecord.operation,
          externalSystem: syncRecord.externalSystem,
          retryCount: newRetryCount
        }
      });
      
      dbLogger.error('Sync failed permanently', {
        syncId: syncRecord.id,
        error: errorMessage,
        retryCount: newRetryCount
      });
    } else {
      // Schedule retry with exponential backoff
      const nextRetryAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 60000); // 2^n minutes
      
      dbUtils.run(`
        UPDATE sync_records 
        SET status = 'retrying', error = ?, retryCount = ?, 
            nextRetryAt = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [errorMessage, newRetryCount, nextRetryAt.toISOString(), syncRecord.id]);
      
      dbLogger.warn('Sync failed, scheduled for retry', {
        syncId: syncRecord.id,
        error: errorMessage,
        retryCount: newRetryCount,
        nextRetryAt: nextRetryAt.toISOString()
      });
    }
  }
};

/**
 * Get sync status for entity
 */
export const getSyncStatus = async (entityType: string, entityId: string): Promise<any[]> => {
  return await dbUtils.all(`
    SELECT * FROM sync_records
    WHERE entityType = ? AND entityId = ?
    ORDER BY createdAt DESC
  `, [entityType, entityId]);
};

/**
 * Retry failed sync records
 */
export const retryFailedSyncs = async (entityType?: string, externalSystem?: string): Promise<number> => {
  try {
    let query = `
      UPDATE sync_records 
      SET status = 'pending', nextRetryAt = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE status = 'failed'
    `;
    const params: any[] = [];
    
    if (entityType) {
      query += ' AND entityType = ?';
      params.push(entityType);
    }
    
    if (externalSystem) {
      query += ' AND externalSystem = ?';
      params.push(externalSystem);
    }
    
    const result = dbUtils.run(query, params);
    
    dbLogger.info('Failed syncs reset for retry', {
      count: result.changes,
      entityType,
      externalSystem
    });
    
    return result.changes || 0;
  } catch (error) {
    dbLogger.error('Failed to retry failed syncs:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityType,
      externalSystem
    });
    return 0;
  }
};

/**
 * Clean up old sync records
 */
export const cleanupOldSyncRecords = (retentionDays: number = 90): number => {
  try {
    const result = dbUtils.run(`
      DELETE FROM sync_records 
      WHERE status IN ('completed', 'failed')
      AND createdAt < datetime('now', '-${retentionDays} days')
    `);
    
    dbLogger.info('Old sync records cleaned up', {
      deletedCount: result.changes,
      retentionDays
    });
    
    return result.changes || 0;
  } catch (error) {
    dbLogger.error('Failed to cleanup old sync records:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      retentionDays
    });
    return 0;
  }
};


