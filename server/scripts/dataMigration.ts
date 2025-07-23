#!/usr/bin/env ts-node
/**
 * AI Catalyst Data Migration Script
 * Safely migrates data from SQLite to PostgreSQL with integrity verification
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface MigrationOptions {
  sourceDb?: string;
  targetDb?: string;
  batchSize?: number;
  verifyIntegrity?: boolean;
  dryRun?: boolean;
  skipTables?: string[];
  onlyTables?: string[];
}

interface MigrationResult {
  success: boolean;
  tablesProcessed: number;
  totalRecords: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

class DataMigrationService {
  private sourceDb: Database.Database;
  private targetPool: Pool;
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      batchSize: 1000,
      verifyIntegrity: true,
      dryRun: false,
      skipTables: ['sqlite_sequence', 'sqlite_master'],
      ...options
    };

    // Initialize SQLite source database
    const sqliteDbPath = options.sourceDb || process.env.DATABASE_PATH || 
                        path.join(__dirname, '../data/ai-catalyst.db');
    
    if (!fs.existsSync(sqliteDbPath)) {
      throw new Error(`SQLite database not found: ${sqliteDbPath}`);
    }

    this.sourceDb = new Database(sqliteDbPath, { readonly: true });

    // Initialize PostgreSQL target database
    this.targetPool = new Pool({
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
   * Get all tables from SQLite database
   */
  private getSourceTables(): string[] {
    const tables = this.sourceDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    let filteredTables = tables.map(t => t.name);

    // Apply filters
    if (this.options.skipTables) {
      filteredTables = filteredTables.filter(table => !this.options.skipTables!.includes(table));
    }

    if (this.options.onlyTables) {
      filteredTables = filteredTables.filter(table => this.options.onlyTables!.includes(table));
    }

    return filteredTables;
  }

  /**
   * Get table schema information from SQLite
   */
  private getTableSchema(tableName: string): any[] {
    return this.sourceDb.prepare(`PRAGMA table_info(${tableName})`).all();
  }

  /**
   * Get row count for a table
   */
  private getTableRowCount(tableName: string): number {
    const result = this.sourceDb.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
    return result.count;
  }

  /**
   * Export data from SQLite table
   */
  private exportTableData(tableName: string): any[] {
    try {
      const data = this.sourceDb.prepare(`SELECT * FROM "${tableName}"`).all();
      dbLogger.info(`Exported ${data.length} records from table: ${tableName}`);
      return data;
    } catch (error) {
      dbLogger.error(`Failed to export data from table ${tableName}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Convert SQLite data types to PostgreSQL compatible values
   */
  private convertDataForPostgreSQL(data: any[], tableName: string): any[] {
    return data.map(row => {
      const convertedRow: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          convertedRow[key] = null;
        } else if (typeof value === 'boolean') {
          convertedRow[key] = value;
        } else if (typeof value === 'number') {
          convertedRow[key] = value;
        } else if (typeof value === 'string') {
          // Handle JSON strings
          if (key.includes('Data') || key.includes('Info') || key.includes('Metadata') || 
              key === 'completedSteps' || key === 'requiredDocuments' || key === 'actionableSteps') {
            try {
              // Validate JSON
              JSON.parse(value);
              convertedRow[key] = value;
            } catch {
              convertedRow[key] = value;
            }
          } else {
            convertedRow[key] = value;
          }
        } else {
          convertedRow[key] = value;
        }
      }
      
      return convertedRow;
    });
  }

  /**
   * Import data to PostgreSQL table
   */
  private async importTableData(tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) {
      dbLogger.info(`No data to import for table: ${tableName}`);
      return;
    }

    const client = await this.targetPool.connect();
    
    try {
      await client.query('BEGIN');

      // Clear existing data if not dry run
      if (!this.options.dryRun) {
        await client.query(`DELETE FROM "${tableName}"`);
        dbLogger.info(`Cleared existing data from PostgreSQL table: ${tableName}`);
      }

      // Prepare insert statement
      const columns = Object.keys(data[0]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');
      
      const insertSQL = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

      // Insert data in batches
      const batchSize = this.options.batchSize || 1000;
      let insertedCount = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        for (const row of batch) {
          const values = columns.map(col => row[col]);
          
          if (!this.options.dryRun) {
            await client.query(insertSQL, values);
          }
          insertedCount++;
        }

        dbLogger.info(`Processed ${Math.min(i + batchSize, data.length)}/${data.length} records for ${tableName}`);
      }

      await client.query('COMMIT');
      dbLogger.info(`Successfully imported ${insertedCount} records to table: ${tableName}`);

    } catch (error) {
      await client.query('ROLLBACK');
      dbLogger.error(`Failed to import data to table ${tableName}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify data integrity between source and target
   */
  private async verifyTableIntegrity(tableName: string): Promise<{ valid: boolean; details: string }> {
    try {
      // Get row counts
      const sourceCount = this.getTableRowCount(tableName);
      
      const client = await this.targetPool.connect();
      const targetResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const targetCount = parseInt(targetResult.rows[0].count);
      client.release();

      if (sourceCount === targetCount) {
        return { valid: true, details: `Row counts match: ${sourceCount}` };
      } else {
        return { 
          valid: false, 
          details: `Row count mismatch - Source: ${sourceCount}, Target: ${targetCount}` 
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        details: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Perform complete data migration
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      tablesProcessed: 0,
      totalRecords: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      dbLogger.info('Starting data migration from SQLite to PostgreSQL', {
        dryRun: this.options.dryRun,
        batchSize: this.options.batchSize,
        verifyIntegrity: this.options.verifyIntegrity
      });

      // Test connections
      await this.testConnections();

      // Get tables to migrate
      const tables = this.getSourceTables();
      dbLogger.info(`Found ${tables.length} tables to migrate:`, tables);

      // Define table migration order (to handle foreign key dependencies)
      const migrationOrder = [
        'users', 'addresses', 'companies', 'registered_agents',
        'user_roles', 'user_sessions', 'notification_preferences',
        'veteran_verification', 'encryption_keys', 'document_templates',
        'documents', 'uploaded_documents', 'document_analysis_results',
        'document_data_points', 'document_cross_references',
        'grant_opportunities', 'grant_matches', 'wizard_progress',
        'business_formation_workflows', 'generated_documents',
        'boi_compliance', 'beneficial_owners', 'identification_documents',
        'compliance_checkpoints', 'audit_logs', 'analytics_events',
        'sync_records', 'schema_version'
      ];

      // Sort tables by migration order
      const orderedTables = migrationOrder.filter(table => tables.includes(table))
        .concat(tables.filter(table => !migrationOrder.includes(table)));

      // Migrate each table
      for (const tableName of orderedTables) {
        try {
          dbLogger.info(`Migrating table: ${tableName}`);

          // Export data from SQLite
          const sourceData = this.exportTableData(tableName);
          
          if (sourceData.length > 0) {
            // Convert data for PostgreSQL
            const convertedData = this.convertDataForPostgreSQL(sourceData, tableName);
            
            // Import to PostgreSQL
            await this.importTableData(tableName, convertedData);
            
            // Verify integrity if requested
            if (this.options.verifyIntegrity) {
              const verification = await this.verifyTableIntegrity(tableName);
              if (!verification.valid) {
                result.warnings.push(`${tableName}: ${verification.details}`);
              }
            }

            result.totalRecords += sourceData.length;
          }

          result.tablesProcessed++;

        } catch (error) {
          const errorMessage = `Failed to migrate table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          dbLogger.error(errorMessage);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      dbLogger.info('Data migration completed', {
        success: result.success,
        tablesProcessed: result.tablesProcessed,
        totalRecords: result.totalRecords,
        errors: result.errors.length,
        warnings: result.warnings.length,
        duration: result.duration
      });

      return result;

    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.duration = Date.now() - startTime;
      dbLogger.error('Data migration failed:', { error: result.errors });
      return result;
    }
  }

  /**
   * Test database connections
   */
  private async testConnections(): Promise<void> {
    // Test SQLite connection
    try {
      this.sourceDb.prepare('SELECT 1').get();
      dbLogger.info('SQLite connection successful');
    } catch (error) {
      throw new Error(`SQLite connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test PostgreSQL connection
    try {
      const client = await this.targetPool.connect();
      await client.query('SELECT 1');
      client.release();
      dbLogger.info('PostgreSQL connection successful');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    this.sourceDb.close();
    await this.targetPool.end();
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'migrate';
  const options: MigrationOptions = {};

  // Parse command line options
  if (process.argv.includes('--dry-run')) {
    options.dryRun = true;
  }
  if (process.argv.includes('--no-verify')) {
    options.verifyIntegrity = false;
  }

  const batchSizeIndex = process.argv.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && process.argv[batchSizeIndex + 1]) {
    options.batchSize = parseInt(process.argv[batchSizeIndex + 1]);
  }

  const migrationService = new DataMigrationService(options);

  try {
    switch (command) {
      case 'migrate':
        const result = await migrationService.migrate();
        
        console.log('\n📊 Migration Results:');
        console.log(`✅ Success: ${result.success}`);
        console.log(`📋 Tables Processed: ${result.tablesProcessed}`);
        console.log(`📊 Total Records: ${result.totalRecords}`);
        console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
        
        if (result.errors.length > 0) {
          console.log(`❌ Errors: ${result.errors.length}`);
          result.errors.forEach(error => console.log(`   ${error}`));
        }
        
        if (result.warnings.length > 0) {
          console.log(`⚠️  Warnings: ${result.warnings.length}`);
          result.warnings.forEach(warning => console.log(`   ${warning}`));
        }

        process.exit(result.success ? 0 : 1);
        break;

      default:
        console.log(`
AI Catalyst Data Migration Tool

Usage:
  dataMigration migrate              Migrate data from SQLite to PostgreSQL
  
Options:
  --dry-run                         Preview migration without making changes
  --no-verify                       Skip data integrity verification
  --batch-size <number>             Set batch size for inserts (default: 1000)

Examples:
  npm run db:migrate:data                    # Full migration
  npm run db:migrate:data -- --dry-run      # Preview migration
  npm run db:migrate:data -- --batch-size 500  # Custom batch size
        `);
        break;
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationService.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DataMigrationService };
