#!/usr/bin/env ts-node
/**
 * AI Catalyst Database Backup Script
 * Handles both SQLite and PostgreSQL backups
 */
interface BackupOptions {
    outputDir?: string;
    includeData?: boolean;
    compress?: boolean;
    timestamp?: boolean;
}
declare class DatabaseBackupService {
    private backupDir;
    private databaseType;
    constructor();
    /**
     * Create a backup of the current database
     */
    createBackup(options?: BackupOptions): Promise<string>;
    /**
     * Create PostgreSQL backup using pg_dump
     */
    private createPostgreSQLBackup;
    /**
     * Create SQLite backup by copying the database file
     */
    private createSQLiteBackup;
    /**
     * List available backups
     */
    listBackups(): Array<{
        filename: string;
        path: string;
        size: number;
        created: Date;
    }>;
    /**
     * Clean up old backups (keep only the specified number)
     */
    cleanupOldBackups(keepCount?: number): void;
    /**
     * Format bytes to human readable string
     */
    private formatBytes;
}
export { DatabaseBackupService };
//# sourceMappingURL=backup.d.ts.map