#!/usr/bin/env ts-node
/**
 * AI Catalyst Migration Status Tracker
 * Provides detailed information about database migration status
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface MigrationInfo {
  version: number;
  filename: string;
  applied: boolean;
  appliedAt?: Date;
  description?: string;
}

interface DatabaseStatus {
  databaseType: 'sqlite' | 'postgresql';
  currentVersion: number;
  latestVersion: number;
  isUpToDate: boolean;
  pendingMigrations: MigrationInfo[];
  appliedMigrations: MigrationInfo[];
  connectionStatus: 'connected' | 'disconnected' | 'error';
  schemaValidation: {
    valid: boolean;
    missingTables: string[];
    extraTables: string[];
  };
}

class MigrationStatusTracker {
  private databaseType: string;
  private migrationsDir: string;

  constructor() {
    this.databaseType = process.env.DATABASE_TYPE || 'sqlite';
    this.migrationsDir = path.join(__dirname, '../migrations');
  }

  /**
   * Get comprehensive migration status
   */
  async getStatus(): Promise<DatabaseStatus> {
    const connectionStatus = await this.checkConnection();
    const currentVersion = await this.getCurrentVersion();
    const availableMigrations = this.getAvailableMigrations();
    const latestVersion = Math.max(...availableMigrations.map(m => m.version), 0);
    
    const appliedVersions = await this.getAppliedVersions();
    
    const appliedMigrations = availableMigrations
      .filter(m => appliedVersions.includes(m.version))
      .map(m => ({ ...m, applied: true }));
    
    const pendingMigrations = availableMigrations
      .filter(m => !appliedVersions.includes(m.version))
      .map(m => ({ ...m, applied: false }));

    const schemaValidation = await this.validateSchema();

    return {
      databaseType: this.databaseType as 'sqlite' | 'postgresql',
      currentVersion,
      latestVersion,
      isUpToDate: currentVersion >= latestVersion,
      pendingMigrations,
      appliedMigrations,
      connectionStatus,
      schemaValidation
    };
  }

  /**
   * Check database connection
   */
  private async checkConnection(): Promise<'connected' | 'disconnected' | 'error'> {
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
        return 'connected';
      } else {
        // SQLite connection check
        const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/ai-catalyst.db');
        if (fs.existsSync(dbPath)) {
          return 'connected';
        } else {
          return 'disconnected';
        }
      }
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Get current schema version from database
   */
  private async getCurrentVersion(): Promise<number> {
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

        try {
          const result = await pool.query('SELECT MAX(version) as version FROM schema_version');
          return result.rows[0]?.version || 0;
        } finally {
          await pool.end();
        }
      } else {
        // SQLite version check would go here
        return 0;
      }
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all applied migration versions
   */
  private async getAppliedVersions(): Promise<number[]> {
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

        try {
          const result = await pool.query('SELECT version, "appliedAt" FROM schema_version ORDER BY version');
          return result.rows.map(row => row.version);
        } finally {
          await pool.end();
        }
      } else {
        // SQLite version check would go here
        return [];
      }
    } catch (error) {
      return [];
    }
  }

  /**
   * Get available migration files
   */
  private getAvailableMigrations(): MigrationInfo[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (match) {
          const version = parseInt(match[1]);
          const description = match[2].replace(/_/g, ' ');
          return {
            version,
            filename: file,
            applied: false,
            description
          };
        }
        return null;
      })
      .filter(Boolean) as MigrationInfo[];

    return files.sort((a, b) => a.version - b.version);
  }

  /**
   * Validate database schema
   */
  private async validateSchema(): Promise<{ valid: boolean; missingTables: string[]; extraTables: string[] }> {
    const expectedTables = [
      'users', 'addresses', 'companies', 'registered_agents', 'boi_compliance',
      'beneficial_owners', 'identification_documents', 'document_templates',
      'documents', 'wizard_progress', 'business_formation_workflows',
      'generated_documents', 'compliance_checkpoints', 'user_sessions',
      'user_roles', 'veteran_verification', 'audit_logs', 'encryption_keys',
      'notification_preferences', 'uploaded_documents', 'document_analysis_results',
      'document_data_points', 'document_cross_references', 'sync_records',
      'analytics_events', 'grant_opportunities', 'grant_matches', 'schema_version'
    ];

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

        try {
          const result = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename NOT LIKE 'pg_%'
            AND tablename NOT LIKE 'sql_%'
          `);

          const actualTables = result.rows.map(row => row.tablename);
          const missingTables = expectedTables.filter(table => !actualTables.includes(table));
          const extraTables = actualTables.filter(table => !expectedTables.includes(table));

          return {
            valid: missingTables.length === 0,
            missingTables,
            extraTables
          };
        } finally {
          await pool.end();
        }
      } else {
        // SQLite validation would go here
        return { valid: true, missingTables: [], extraTables: [] };
      }
    } catch (error) {
      return { valid: false, missingTables: expectedTables, extraTables: [] };
    }
  }

  /**
   * Display formatted status report
   */
  async displayStatus(): Promise<void> {
    console.log('🔍 AI Catalyst Database Migration Status\n');

    const status = await this.getStatus();

    // Connection Status
    const connectionIcon = status.connectionStatus === 'connected' ? '✅' : 
                          status.connectionStatus === 'disconnected' ? '⚠️' : '❌';
    console.log(`${connectionIcon} Database Connection: ${status.connectionStatus.toUpperCase()}`);
    console.log(`📊 Database Type: ${status.databaseType.toUpperCase()}`);
    console.log(`📈 Current Version: ${status.currentVersion}`);
    console.log(`🎯 Latest Version: ${status.latestVersion}`);
    console.log(`${status.isUpToDate ? '✅' : '⚠️'} Status: ${status.isUpToDate ? 'UP TO DATE' : 'MIGRATIONS PENDING'}\n`);

    // Schema Validation
    const schemaIcon = status.schemaValidation.valid ? '✅' : '❌';
    console.log(`${schemaIcon} Schema Validation: ${status.schemaValidation.valid ? 'VALID' : 'INVALID'}`);
    if (status.schemaValidation.missingTables.length > 0) {
      console.log(`   Missing Tables: ${status.schemaValidation.missingTables.join(', ')}`);
    }
    if (status.schemaValidation.extraTables.length > 0) {
      console.log(`   Extra Tables: ${status.schemaValidation.extraTables.join(', ')}`);
    }
    console.log();

    // Applied Migrations
    if (status.appliedMigrations.length > 0) {
      console.log('✅ Applied Migrations:');
      status.appliedMigrations.forEach(migration => {
        console.log(`   ${migration.version.toString().padStart(3, '0')} - ${migration.description || migration.filename}`);
      });
      console.log();
    }

    // Pending Migrations
    if (status.pendingMigrations.length > 0) {
      console.log('⏳ Pending Migrations:');
      status.pendingMigrations.forEach(migration => {
        console.log(`   ${migration.version.toString().padStart(3, '0')} - ${migration.description || migration.filename}`);
      });
      console.log();
      console.log('💡 Run "npm run db:migrate:latest" to apply pending migrations');
    }

    // Summary
    console.log('📋 Summary:');
    console.log(`   Applied: ${status.appliedMigrations.length} migrations`);
    console.log(`   Pending: ${status.pendingMigrations.length} migrations`);
    console.log(`   Schema Valid: ${status.schemaValidation.valid ? 'Yes' : 'No'}`);
  }

  /**
   * Export status as JSON
   */
  async exportStatus(outputPath?: string): Promise<void> {
    const status = await this.getStatus();
    const json = JSON.stringify(status, null, 2);

    if (outputPath) {
      fs.writeFileSync(outputPath, json);
      console.log(`✅ Status exported to: ${outputPath}`);
    } else {
      console.log(json);
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'status';
  const tracker = new MigrationStatusTracker();

  try {
    switch (command) {
      case 'status':
        await tracker.displayStatus();
        break;
      case 'export':
        const outputPath = process.argv[3];
        await tracker.exportStatus(outputPath);
        break;
      case 'json':
        await tracker.exportStatus();
        break;
      default:
        console.log(`
AI Catalyst Migration Status Tracker

Usage:
  migrationStatus status    Display formatted status report
  migrationStatus export    Export status as JSON to file
  migrationStatus json      Output status as JSON to console
        `);
        break;
    }
  } catch (error) {
    console.error('Status check failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationStatusTracker };
