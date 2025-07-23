#!/usr/bin/env ts-node
/**
 * AI Catalyst Database Rollback Script
 * Handles rollback procedures for both SQLite and PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface RollbackOptions {
  backupPath?: string;
  targetVersion?: number;
  dryRun?: boolean;
  force?: boolean;
}

class DatabaseRollbackService {
  private databaseType: string;
  private backupDir: string;

  constructor() {
    this.databaseType = process.env.DATABASE_TYPE || 'sqlite';
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
  }

  /**
   * Perform database rollback
   */
  async performRollback(options: RollbackOptions = {}): Promise<void> {
    const { backupPath, targetVersion, dryRun = false, force = false } = options;

    if (!force && !dryRun) {
      console.log('⚠️  WARNING: This operation will modify your database!');
      console.log('Use --dry-run to preview changes or --force to proceed.');
      return;
    }

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    try {
      if (backupPath) {
        await this.restoreFromBackup(backupPath, dryRun);
      } else if (targetVersion !== undefined) {
        await this.rollbackToVersion(targetVersion, dryRun);
      } else {
        await this.rollbackLastMigration(dryRun);
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  private async restoreFromBackup(backupPath: string, dryRun: boolean): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    console.log(`📦 Restoring database from backup: ${backupPath}`);

    if (dryRun) {
      console.log('Would restore from backup (dry run)');
      return;
    }

    if (this.databaseType === 'postgresql') {
      await this.restorePostgreSQLBackup(backupPath);
    } else {
      await this.restoreSQLiteBackup(backupPath);
    }

    console.log('✅ Database restored successfully');
  }

  /**
   * Restore PostgreSQL from backup
   */
  private async restorePostgreSQLBackup(backupPath: string): Promise<void> {
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DATABASE || 'ai_catalyst_dev';
    const user = process.env.POSTGRES_USER || 'ai_catalyst_user';

    // Create a new database for restoration (to avoid conflicts)
    const restoreDatabase = `${database}_restore_${Date.now()}`;
    
    try {
      // Create restore database
      const createDbCommand = `createdb -h ${host} -p ${port} -U ${user} ${restoreDatabase}`;
      const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };
      
      console.log(`Creating restore database: ${restoreDatabase}`);
      await execAsync(createDbCommand, { env });

      // Restore backup to new database
      let restoreCommand;
      if (backupPath.endsWith('.gz')) {
        restoreCommand = `gunzip -c "${backupPath}" | psql -h ${host} -p ${port} -U ${user} -d ${restoreDatabase}`;
      } else {
        restoreCommand = `psql -h ${host} -p ${port} -U ${user} -d ${restoreDatabase} -f "${backupPath}"`;
      }

      console.log('Restoring backup data...');
      await execAsync(restoreCommand, { env });

      // Verify restoration
      const verifyCommand = `psql -h ${host} -p ${port} -U ${user} -d ${restoreDatabase} -c "SELECT COUNT(*) FROM schema_version;"`;
      await execAsync(verifyCommand, { env });

      console.log(`✅ Backup restored to database: ${restoreDatabase}`);
      console.log(`⚠️  Manual step required: Rename ${restoreDatabase} to ${database} when ready`);

    } catch (error) {
      // Cleanup on failure
      try {
        const dropCommand = `dropdb -h ${host} -p ${port} -U ${user} ${restoreDatabase}`;
        const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };
        await execAsync(dropCommand, { env });
      } catch (cleanupError) {
        console.warn('Failed to cleanup restore database:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Restore SQLite from backup
   */
  private async restoreSQLiteBackup(backupPath: string): Promise<void> {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/ai-catalyst.db');
    const backupDbPath = `${dbPath}.backup.${Date.now()}`;

    try {
      // Backup current database
      if (fs.existsSync(dbPath)) {
        console.log('Creating backup of current database...');
        fs.copyFileSync(dbPath, backupDbPath);
      }

      // Restore from backup
      if (backupPath.endsWith('.gz')) {
        const command = `gunzip -c "${backupPath}" > "${dbPath}"`;
        await execAsync(command);
      } else {
        fs.copyFileSync(backupPath, dbPath);
      }

      console.log(`✅ Database restored from: ${backupPath}`);
      console.log(`📦 Previous database backed up to: ${backupDbPath}`);

    } catch (error) {
      // Restore original database on failure
      if (fs.existsSync(backupDbPath)) {
        fs.copyFileSync(backupDbPath, dbPath);
        fs.unlinkSync(backupDbPath);
      }
      throw error;
    }
  }

  /**
   * Rollback to specific schema version
   */
  private async rollbackToVersion(targetVersion: number, dryRun: boolean): Promise<void> {
    console.log(`🔄 Rolling back to schema version ${targetVersion}`);

    if (dryRun) {
      console.log(`Would rollback to version ${targetVersion} (dry run)`);
      return;
    }

    // For now, this is a simplified rollback that just updates the version
    // In a production system, you'd want proper rollback scripts
    if (this.databaseType === 'postgresql') {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'ai_catalyst_dev',
        user: process.env.POSTGRES_USER || 'ai_catalyst_user',
        password: process.env.POSTGRES_PASSWORD,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });

      try {
        await pool.query('DELETE FROM schema_version WHERE version > $1', [targetVersion]);
        console.log(`✅ Rolled back to version ${targetVersion}`);
      } finally {
        await pool.end();
      }
    } else {
      // SQLite rollback would go here
      console.log('SQLite version rollback not implemented yet');
    }
  }

  /**
   * Rollback last migration
   */
  private async rollbackLastMigration(dryRun: boolean): Promise<void> {
    console.log('🔄 Rolling back last migration');

    if (dryRun) {
      console.log('Would rollback last migration (dry run)');
      return;
    }

    // Import and use the migration service
    const { DatabaseMigrator } = await import('./migrate');
    const migrator = new DatabaseMigrator();
    
    try {
      await migrator.migrateDown();
      console.log('✅ Last migration rolled back successfully');
    } finally {
      await migrator.close();
    }
  }

  /**
   * List available backups for rollback
   */
  listAvailableBackups(): Array<{ filename: string; path: string; size: number; created: Date }> {
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
   * Validate rollback safety
   */
  async validateRollbackSafety(targetVersion?: number): Promise<{ safe: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let safe = true;

    // Check if backup exists
    const backups = this.listAvailableBackups();
    if (backups.length === 0) {
      warnings.push('No backups available - consider creating a backup before rollback');
      safe = false;
    }

    // Check if target version is valid
    if (targetVersion !== undefined && targetVersion < 0) {
      warnings.push('Invalid target version specified');
      safe = false;
    }

    // Check database connectivity
    try {
      if (this.databaseType === 'postgresql') {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          database: process.env.POSTGRES_DATABASE || 'ai_catalyst_dev',
          user: process.env.POSTGRES_USER || 'ai_catalyst_user',
          password: process.env.POSTGRES_PASSWORD,
          ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });

        await pool.query('SELECT 1');
        await pool.end();
      }
    } catch (error) {
      warnings.push('Database connectivity issues detected');
      safe = false;
    }

    return { safe, warnings };
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'help';
  const rollbackService = new DatabaseRollbackService();
  
  try {
    switch (command) {
      case 'backup':
        const backupPath = process.argv[3];
        if (!backupPath) {
          console.error('Usage: rollback backup <backup-path>');
          process.exit(1);
        }
        await rollbackService.performRollback({ 
          backupPath, 
          force: process.argv.includes('--force'),
          dryRun: process.argv.includes('--dry-run')
        });
        break;
        
      case 'version':
        const targetVersion = parseInt(process.argv[3]);
        if (isNaN(targetVersion)) {
          console.error('Usage: rollback version <version-number>');
          process.exit(1);
        }
        await rollbackService.performRollback({ 
          targetVersion, 
          force: process.argv.includes('--force'),
          dryRun: process.argv.includes('--dry-run')
        });
        break;
        
      case 'last':
        await rollbackService.performRollback({ 
          force: process.argv.includes('--force'),
          dryRun: process.argv.includes('--dry-run')
        });
        break;
        
      case 'list':
        const backups = rollbackService.listAvailableBackups();
        console.log('\nAvailable backups for rollback:');
        if (backups.length === 0) {
          console.log('No backups found');
        } else {
          backups.forEach((backup, index) => {
            const size = (backup.size / 1024 / 1024).toFixed(2);
            console.log(`${index + 1}. ${backup.filename} (${size} MB) - ${backup.created.toISOString()}`);
          });
        }
        break;
        
      case 'validate':
        const validation = await rollbackService.validateRollbackSafety();
        console.log(`\nRollback safety check: ${validation.safe ? '✅ SAFE' : '❌ UNSAFE'}`);
        if (validation.warnings.length > 0) {
          console.log('\nWarnings:');
          validation.warnings.forEach(warning => console.log(`⚠️  ${warning}`));
        }
        break;
        
      case 'help':
      default:
        console.log(`
AI Catalyst Database Rollback Tool

Usage:
  rollback backup <backup-path>     Restore from specific backup
  rollback version <version>        Rollback to specific schema version
  rollback last                     Rollback last migration
  rollback list                     List available backups
  rollback validate                 Check rollback safety
  rollback help                     Show this help

Options:
  --dry-run                         Preview changes without executing
  --force                           Execute without confirmation
        `);
        break;
    }
  } catch (error) {
    console.error('Rollback operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabaseRollbackService };
