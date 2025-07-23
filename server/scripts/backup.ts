#!/usr/bin/env ts-node
/**
 * AI Catalyst Database Backup Script
 * Handles both SQLite and PostgreSQL backups
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface BackupOptions {
  outputDir?: string;
  includeData?: boolean;
  compress?: boolean;
  timestamp?: boolean;
}

class DatabaseBackupService {
  private backupDir: string;
  private databaseType: string;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
    this.databaseType = process.env.DATABASE_TYPE || 'sqlite';
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the current database
   */
  async createBackup(options: BackupOptions = {}): Promise<string> {
    const {
      outputDir = this.backupDir,
      includeData = true,
      compress = true,
      timestamp = true
    } = options;

    const timestampStr = timestamp ? `_${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
    
    if (this.databaseType === 'postgresql') {
      return await this.createPostgreSQLBackup(outputDir, timestampStr, includeData, compress);
    } else {
      return await this.createSQLiteBackup(outputDir, timestampStr, compress);
    }
  }

  /**
   * Create PostgreSQL backup using pg_dump
   */
  private async createPostgreSQLBackup(
    outputDir: string,
    timestampStr: string,
    includeData: boolean,
    compress: boolean
  ): Promise<string> {
    const filename = `ai_catalyst_backup${timestampStr}.sql${compress ? '.gz' : ''}`;
    const backupPath = path.join(outputDir, filename);
    
    // Build pg_dump command
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DATABASE || 'ai_catalyst_dev';
    const user = process.env.POSTGRES_USER || 'ai_catalyst_user';
    
    let command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database}`;
    
    // Add options
    command += ' --verbose --clean --if-exists --create';
    
    if (!includeData) {
      command += ' --schema-only';
    }
    
    // Set password via environment variable
    const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };
    
    if (compress) {
      command += ` | gzip > "${backupPath}"`;
    } else {
      command += ` > "${backupPath}"`;
    }
    
    try {
      console.log(`Creating PostgreSQL backup: ${filename}`);
      await execAsync(command, { env });
      
      const stats = fs.statSync(backupPath);
      console.log(`✅ Backup created successfully: ${backupPath} (${this.formatBytes(stats.size)})`);
      
      dbLogger.info('PostgreSQL backup created', {
        filename,
        path: backupPath,
        size: stats.size,
        includeData,
        compressed: compress
      });
      
      return backupPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ PostgreSQL backup failed: ${errorMessage}`);
      dbLogger.error('PostgreSQL backup failed', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Create SQLite backup by copying the database file
   */
  private async createSQLiteBackup(
    outputDir: string,
    timestampStr: string,
    compress: boolean
  ): Promise<string> {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/ai-catalyst.db');
    const filename = `ai_catalyst_backup${timestampStr}.db${compress ? '.gz' : ''}`;
    const backupPath = path.join(outputDir, filename);
    
    try {
      console.log(`Creating SQLite backup: ${filename}`);
      
      if (!fs.existsSync(dbPath)) {
        throw new Error(`SQLite database file not found: ${dbPath}`);
      }
      
      if (compress) {
        // Compress the database file
        const command = `gzip -c "${dbPath}" > "${backupPath}"`;
        await execAsync(command);
      } else {
        // Simple file copy
        fs.copyFileSync(dbPath, backupPath);
      }
      
      const stats = fs.statSync(backupPath);
      console.log(`✅ Backup created successfully: ${backupPath} (${this.formatBytes(stats.size)})`);
      
      dbLogger.info('SQLite backup created', {
        filename,
        path: backupPath,
        size: stats.size,
        compressed: compress
      });
      
      return backupPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ SQLite backup failed: ${errorMessage}`);
      dbLogger.error('SQLite backup failed', { error: errorMessage });
      throw error;
    }
  }

  /**
   * List available backups
   */
  listBackups(): Array<{ filename: string; path: string; size: number; created: Date }> {
    const backups: Array<{ filename: string; path: string; size: number; created: Date }> = [];
    
    if (!fs.existsSync(this.backupDir)) {
      return backups;
    }
    
    const files = fs.readdirSync(this.backupDir);
    
    for (const file of files) {
      if (file.startsWith('ai_catalyst_backup')) {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        backups.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime
        });
      }
    }
    
    // Sort by creation date (newest first)
    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Clean up old backups (keep only the specified number)
   */
  cleanupOldBackups(keepCount: number = 10): void {
    const backups = this.listBackups();
    
    if (backups.length <= keepCount) {
      console.log(`No cleanup needed. Found ${backups.length} backups, keeping ${keepCount}`);
      return;
    }
    
    const toDelete = backups.slice(keepCount);
    
    console.log(`Cleaning up ${toDelete.length} old backups...`);
    
    for (const backup of toDelete) {
      try {
        fs.unlinkSync(backup.path);
        console.log(`Deleted old backup: ${backup.filename}`);
      } catch (error) {
        console.error(`Failed to delete backup ${backup.filename}:`, error);
      }
    }
    
    dbLogger.info('Backup cleanup completed', {
      totalBackups: backups.length,
      kept: keepCount,
      deleted: toDelete.length
    });
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'create';
  const backupService = new DatabaseBackupService();
  
  try {
    switch (command) {
      case 'create':
        await backupService.createBackup();
        break;
      case 'list':
        const backups = backupService.listBackups();
        console.log('\nAvailable backups:');
        if (backups.length === 0) {
          console.log('No backups found');
        } else {
          backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.filename} (${backupService['formatBytes'](backup.size)}) - ${backup.created.toISOString()}`);
          });
        }
        break;
      case 'cleanup':
        const keepCount = parseInt(process.argv[3]) || 10;
        backupService.cleanupOldBackups(keepCount);
        break;
      default:
        console.error('Unknown command. Use: create, list, or cleanup [count]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Backup operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabaseBackupService };
