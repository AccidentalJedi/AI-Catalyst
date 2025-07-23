#!/usr/bin/env ts-node
/**
 * AI Catalyst Backup and Recovery Testing Script
 * Validates backup and recovery procedures for PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface BackupRecoveryTestResult {
  success: boolean;
  backupCreated: boolean;
  backupSize: number;
  backupTime: number;
  recoverySuccessful: boolean;
  recoveryTime: number;
  dataIntegrityVerified: boolean;
  errors: string[];
}

class BackupRecoveryTester {
  private pool: Pool;
  private testDbName: string;
  private backupPath: string;

  constructor() {
    this.testDbName = `ai_catalyst_backup_test_${Date.now()}`;
    this.backupPath = path.join(__dirname, '../backups', `test_backup_${Date.now()}.sql`);
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'ai_catalyst_dev',
      user: process.env.POSTGRES_USER || 'ai_catalyst_user',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Create test data for backup testing
   */
  private async createTestData(): Promise<void> {
    console.log('📝 Creating test data...');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create test users
      for (let i = 0; i < 10; i++) {
        const userId = crypto.randomUUID();
        await client.query(`
          INSERT INTO users (
            id, email, "firstName", "lastName", phone, "passwordHash",
            "isActive", "emailVerified", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          userId,
          `test${i}@backup-test.com`,
          `TestUser${i}`,
          'BackupTest',
          `555-010${i}`,
          'test-hash'
        ]);
      }
      
      // Create test grant opportunities
      for (let i = 0; i < 5; i++) {
        const grantId = crypto.randomUUID();
        await client.query(`
          INSERT INTO grant_opportunities (
            id, "grantName", "grantingOrganization", "grantType", "maxGrantAmount",
            "frictionScore", "isActive", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          grantId,
          `Test Grant ${i}`,
          'Test Foundation',
          'financial',
          5000 + (i * 1000),
          5
        ]);
      }
      
      await client.query('COMMIT');
      console.log('✅ Test data created successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(): Promise<{ success: boolean; size: number; time: number }> {
    console.log('💾 Creating database backup...');
    
    const startTime = Date.now();
    
    try {
      const host = process.env.POSTGRES_HOST || 'localhost';
      const port = process.env.POSTGRES_PORT || '5432';
      const database = process.env.POSTGRES_DATABASE || 'ai_catalyst_dev';
      const user = process.env.POSTGRES_USER || 'ai_catalyst_user';
      
      const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} --verbose --clean --if-exists --create > "${this.backupPath}"`;
      
      const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };
      await execAsync(command, { env });
      
      const backupTime = Date.now() - startTime;
      const stats = fs.statSync(this.backupPath);
      
      console.log(`✅ Backup created: ${this.backupPath} (${this.formatBytes(stats.size)})`);
      
      return {
        success: true,
        size: stats.size,
        time: backupTime
      };
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      return {
        success: false,
        size: 0,
        time: Date.now() - startTime
      };
    }
  }

  /**
   * Create test database for recovery
   */
  private async createTestDatabase(): Promise<boolean> {
    console.log(`🔧 Creating test database: ${this.testDbName}`);
    
    try {
      const adminPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: 'postgres', // Connect to default database
        user: process.env.POSTGRES_USER || 'ai_catalyst_user',
        password: process.env.POSTGRES_PASSWORD,
        ssl: false
      });

      await adminPool.query(`CREATE DATABASE "${this.testDbName}"`);
      await adminPool.end();
      
      console.log(`✅ Test database created: ${this.testDbName}`);
      return true;
      
    } catch (error) {
      console.error('❌ Test database creation failed:', error);
      return false;
    }
  }

  /**
   * Restore backup to test database
   */
  private async restoreBackup(): Promise<{ success: boolean; time: number }> {
    console.log('🔄 Restoring backup to test database...');
    
    const startTime = Date.now();
    
    try {
      const host = process.env.POSTGRES_HOST || 'localhost';
      const port = process.env.POSTGRES_PORT || '5432';
      const user = process.env.POSTGRES_USER || 'ai_catalyst_user';
      
      const command = `psql -h ${host} -p ${port} -U ${user} -d ${this.testDbName} -f "${this.backupPath}"`;
      
      const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };
      await execAsync(command, { env });
      
      const restoreTime = Date.now() - startTime;
      
      console.log(`✅ Backup restored successfully in ${restoreTime}ms`);
      
      return {
        success: true,
        time: restoreTime
      };
      
    } catch (error) {
      console.error('❌ Backup restoration failed:', error);
      return {
        success: false,
        time: Date.now() - startTime
      };
    }
  }

  /**
   * Verify data integrity after restore
   */
  private async verifyDataIntegrity(): Promise<boolean> {
    console.log('🔍 Verifying data integrity...');
    
    try {
      // Connect to test database
      const testPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: this.testDbName,
        user: process.env.POSTGRES_USER || 'ai_catalyst_user',
        password: process.env.POSTGRES_PASSWORD,
        ssl: false
      });

      // Get original data counts
      const originalClient = await this.pool.connect();
      const originalUserCount = await originalClient.query('SELECT COUNT(*) as count FROM users WHERE email LIKE \'%backup-test.com\'');
      const originalGrantCount = await originalClient.query('SELECT COUNT(*) as count FROM grant_opportunities WHERE "grantingOrganization" = \'Test Foundation\'');
      originalClient.release();

      // Get restored data counts
      const testClient = await testPool.connect();
      const restoredUserCount = await testClient.query('SELECT COUNT(*) as count FROM users WHERE email LIKE \'%backup-test.com\'');
      const restoredGrantCount = await testClient.query('SELECT COUNT(*) as count FROM grant_opportunities WHERE "grantingOrganization" = \'Test Foundation\'');
      testClient.release();

      await testPool.end();

      const userCountMatch = originalUserCount.rows[0].count === restoredUserCount.rows[0].count;
      const grantCountMatch = originalGrantCount.rows[0].count === restoredGrantCount.rows[0].count;

      if (userCountMatch && grantCountMatch) {
        console.log('✅ Data integrity verified - all counts match');
        return true;
      } else {
        console.error('❌ Data integrity check failed:');
        console.error(`  Users: Original ${originalUserCount.rows[0].count}, Restored ${restoredUserCount.rows[0].count}`);
        console.error(`  Grants: Original ${originalGrantCount.rows[0].count}, Restored ${restoredGrantCount.rows[0].count}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Data integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Clean up test resources
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test resources...');
    
    try {
      // Remove test data from original database
      const client = await this.pool.connect();
      await client.query('BEGIN');
      await client.query('DELETE FROM users WHERE email LIKE \'%backup-test.com\'');
      await client.query('DELETE FROM grant_opportunities WHERE "grantingOrganization" = \'Test Foundation\'');
      await client.query('COMMIT');
      client.release();

      // Drop test database
      const adminPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: 'postgres',
        user: process.env.POSTGRES_USER || 'ai_catalyst_user',
        password: process.env.POSTGRES_PASSWORD,
        ssl: false
      });

      await adminPool.query(`DROP DATABASE IF EXISTS "${this.testDbName}"`);
      await adminPool.end();

      // Remove backup file
      if (fs.existsSync(this.backupPath)) {
        fs.unlinkSync(this.backupPath);
      }

      console.log('✅ Cleanup completed');
      
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }

  /**
   * Run complete backup and recovery test
   */
  async runTest(): Promise<BackupRecoveryTestResult> {
    console.log('🧪 Starting backup and recovery test...');
    
    const result: BackupRecoveryTestResult = {
      success: false,
      backupCreated: false,
      backupSize: 0,
      backupTime: 0,
      recoverySuccessful: false,
      recoveryTime: 0,
      dataIntegrityVerified: false,
      errors: []
    };

    try {
      // Step 1: Create test data
      await this.createTestData();

      // Step 2: Create backup
      const backupResult = await this.createBackup();
      result.backupCreated = backupResult.success;
      result.backupSize = backupResult.size;
      result.backupTime = backupResult.time;

      if (!backupResult.success) {
        result.errors.push('Backup creation failed');
        return result;
      }

      // Step 3: Create test database
      const testDbCreated = await this.createTestDatabase();
      if (!testDbCreated) {
        result.errors.push('Test database creation failed');
        return result;
      }

      // Step 4: Restore backup
      const restoreResult = await this.restoreBackup();
      result.recoverySuccessful = restoreResult.success;
      result.recoveryTime = restoreResult.time;

      if (!restoreResult.success) {
        result.errors.push('Backup restoration failed');
        return result;
      }

      // Step 5: Verify data integrity
      result.dataIntegrityVerified = await this.verifyDataIntegrity();

      if (!result.dataIntegrityVerified) {
        result.errors.push('Data integrity verification failed');
      }

      result.success = result.backupCreated && result.recoverySuccessful && result.dataIntegrityVerified;

      console.log(`${result.success ? '✅' : '❌'} Backup and recovery test ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      result.errors.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Test execution failed:', error);
    } finally {
      await this.cleanup();
    }

    return result;
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

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Main execution
async function main() {
  const tester = new BackupRecoveryTester();

  try {
    const result = await tester.runTest();

    console.log('\n📊 Backup and Recovery Test Results:');
    console.log(`🎯 Overall Success: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`💾 Backup Created: ${result.backupCreated ? '✅' : '❌'}`);
    console.log(`📏 Backup Size: ${result.backupSize > 0 ? `${(result.backupSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`);
    console.log(`⏱️  Backup Time: ${result.backupTime}ms`);
    console.log(`🔄 Recovery Successful: ${result.recoverySuccessful ? '✅' : '❌'}`);
    console.log(`⏱️  Recovery Time: ${result.recoveryTime}ms`);
    console.log(`🔍 Data Integrity: ${result.dataIntegrityVerified ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await tester.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { BackupRecoveryTester };
