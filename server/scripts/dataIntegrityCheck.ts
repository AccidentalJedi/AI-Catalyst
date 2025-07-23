#!/usr/bin/env ts-node
/**
 * AI Catalyst Data Integrity Verification Script
 * Comprehensive verification of data integrity between SQLite and PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface IntegrityCheckResult {
  tableName: string;
  sourceCount: number;
  targetCount: number;
  countMatch: boolean;
  sampleChecksums: {
    source: string;
    target: string;
    match: boolean;
  };
  foreignKeyIntegrity: boolean;
  issues: string[];
}

interface OverallIntegrityResult {
  success: boolean;
  tablesChecked: number;
  totalIssues: number;
  results: IntegrityCheckResult[];
  summary: {
    countMatches: number;
    checksumMatches: number;
    foreignKeyIssues: number;
  };
}

class DataIntegrityChecker {
  private sourceDb: Database.Database;
  private targetPool: Pool;

  constructor() {
    // Initialize SQLite source database
    const sqliteDbPath = process.env.DATABASE_PATH || 
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

    return tables.map(t => t.name);
  }

  /**
   * Check row counts between source and target
   */
  private async checkRowCounts(tableName: string): Promise<{ sourceCount: number; targetCount: number; match: boolean }> {
    // Get SQLite count
    const sourceResult = this.sourceDb.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
    const sourceCount = sourceResult.count;

    // Get PostgreSQL count
    const client = await this.targetPool.connect();
    const targetResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const targetCount = parseInt(targetResult.rows[0].count);
    client.release();

    return {
      sourceCount,
      targetCount,
      match: sourceCount === targetCount
    };
  }

  /**
   * Generate checksum for sample data
   */
  private generateDataChecksum(data: any[]): string {
    const sortedData = data.sort((a, b) => {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      return aStr.localeCompare(bStr);
    });

    const dataString = JSON.stringify(sortedData);
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  /**
   * Check data integrity using checksums
   */
  private async checkDataChecksums(tableName: string, sampleSize: number = 100): Promise<{ source: string; target: string; match: boolean }> {
    try {
      // Get sample data from SQLite
      const sourceData = this.sourceDb.prepare(`
        SELECT * FROM "${tableName}" 
        ORDER BY RANDOM() 
        LIMIT ?
      `).all(sampleSize);

      // Get sample data from PostgreSQL
      const client = await this.targetPool.connect();
      const targetResult = await client.query(`
        SELECT * FROM "${tableName}" 
        ORDER BY RANDOM() 
        LIMIT $1
      `, [sampleSize]);
      const targetData = targetResult.rows;
      client.release();

      // Generate checksums
      const sourceChecksum = this.generateDataChecksum(sourceData);
      const targetChecksum = this.generateDataChecksum(targetData);

      return {
        source: sourceChecksum,
        target: targetChecksum,
        match: sourceChecksum === targetChecksum
      };
    } catch (error) {
      dbLogger.error(`Failed to check data checksums for table ${tableName}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        source: 'error',
        target: 'error',
        match: false
      };
    }
  }

  /**
   * Check foreign key integrity
   */
  private async checkForeignKeyIntegrity(tableName: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    let valid = true;

    try {
      const client = await this.targetPool.connect();

      // Get foreign key constraints for the table
      const fkResult = await client.query(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `, [tableName]);

      // Check each foreign key constraint
      for (const fk of fkResult.rows) {
        const violationResult = await client.query(`
          SELECT COUNT(*) as violations
          FROM "${fk.table_name}" t
          LEFT JOIN "${fk.foreign_table_name}" f
            ON t."${fk.column_name}" = f."${fk.foreign_column_name}"
          WHERE t."${fk.column_name}" IS NOT NULL
            AND f."${fk.foreign_column_name}" IS NULL
        `);

        const violations = parseInt(violationResult.rows[0].violations);
        if (violations > 0) {
          valid = false;
          issues.push(`Foreign key violation: ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (${violations} violations)`);
        }
      }

      client.release();
    } catch (error) {
      valid = false;
      issues.push(`Foreign key check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid, issues };
  }

  /**
   * Check integrity for a single table
   */
  private async checkTableIntegrity(tableName: string): Promise<IntegrityCheckResult> {
    dbLogger.info(`Checking integrity for table: ${tableName}`);

    const result: IntegrityCheckResult = {
      tableName,
      sourceCount: 0,
      targetCount: 0,
      countMatch: false,
      sampleChecksums: {
        source: '',
        target: '',
        match: false
      },
      foreignKeyIntegrity: false,
      issues: []
    };

    try {
      // Check row counts
      const countCheck = await this.checkRowCounts(tableName);
      result.sourceCount = countCheck.sourceCount;
      result.targetCount = countCheck.targetCount;
      result.countMatch = countCheck.match;

      if (!countCheck.match) {
        result.issues.push(`Row count mismatch: Source ${countCheck.sourceCount}, Target ${countCheck.targetCount}`);
      }

      // Check data checksums (only if there's data)
      if (countCheck.sourceCount > 0 && countCheck.targetCount > 0) {
        const checksumCheck = await this.checkDataChecksums(tableName);
        result.sampleChecksums = checksumCheck;

        if (!checksumCheck.match) {
          result.issues.push('Sample data checksum mismatch - data may be corrupted or modified');
        }
      }

      // Check foreign key integrity
      const fkCheck = await this.checkForeignKeyIntegrity(tableName);
      result.foreignKeyIntegrity = fkCheck.valid;
      result.issues.push(...fkCheck.issues);

    } catch (error) {
      result.issues.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Perform comprehensive integrity check
   */
  async checkIntegrity(): Promise<OverallIntegrityResult> {
    dbLogger.info('Starting comprehensive data integrity check');

    const overallResult: OverallIntegrityResult = {
      success: false,
      tablesChecked: 0,
      totalIssues: 0,
      results: [],
      summary: {
        countMatches: 0,
        checksumMatches: 0,
        foreignKeyIssues: 0
      }
    };

    try {
      // Test connections
      await this.testConnections();

      // Get tables to check
      const tables = this.getSourceTables();
      dbLogger.info(`Checking integrity for ${tables.length} tables`);

      // Check each table
      for (const tableName of tables) {
        const tableResult = await this.checkTableIntegrity(tableName);
        overallResult.results.push(tableResult);
        overallResult.tablesChecked++;

        // Update summary
        if (tableResult.countMatch) {
          overallResult.summary.countMatches++;
        }
        if (tableResult.sampleChecksums.match) {
          overallResult.summary.checksumMatches++;
        }
        if (!tableResult.foreignKeyIntegrity) {
          overallResult.summary.foreignKeyIssues++;
        }

        overallResult.totalIssues += tableResult.issues.length;
      }

      overallResult.success = overallResult.totalIssues === 0;

      dbLogger.info('Data integrity check completed', {
        success: overallResult.success,
        tablesChecked: overallResult.tablesChecked,
        totalIssues: overallResult.totalIssues
      });

    } catch (error) {
      dbLogger.error('Data integrity check failed:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return overallResult;
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
  const checker = new DataIntegrityChecker();

  try {
    const result = await checker.checkIntegrity();

    console.log('\n🔍 Data Integrity Check Results\n');
    console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tables Checked: ${result.tablesChecked}`);
    console.log(`Total Issues: ${result.totalIssues}\n`);

    console.log('📊 Summary:');
    console.log(`  Row Count Matches: ${result.summary.countMatches}/${result.tablesChecked}`);
    console.log(`  Checksum Matches: ${result.summary.checksumMatches}/${result.tablesChecked}`);
    console.log(`  Foreign Key Issues: ${result.summary.foreignKeyIssues}\n`);

    // Show detailed results for tables with issues
    const tablesWithIssues = result.results.filter(r => r.issues.length > 0);
    if (tablesWithIssues.length > 0) {
      console.log('❌ Tables with Issues:');
      tablesWithIssues.forEach(table => {
        console.log(`\n  ${table.tableName}:`);
        console.log(`    Source Count: ${table.sourceCount}`);
        console.log(`    Target Count: ${table.targetCount}`);
        console.log(`    Count Match: ${table.countMatch ? '✅' : '❌'}`);
        console.log(`    Checksum Match: ${table.sampleChecksums.match ? '✅' : '❌'}`);
        console.log(`    Foreign Keys: ${table.foreignKeyIntegrity ? '✅' : '❌'}`);
        table.issues.forEach(issue => {
          console.log(`    ⚠️  ${issue}`);
        });
      });
    }

    // Show successful tables
    const successfulTables = result.results.filter(r => r.issues.length === 0);
    if (successfulTables.length > 0) {
      console.log(`\n✅ ${successfulTables.length} tables passed all checks:`);
      successfulTables.forEach(table => {
        console.log(`  ${table.tableName} (${table.sourceCount} records)`);
      });
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('Integrity check failed:', error);
    process.exit(1);
  } finally {
    await checker.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DataIntegrityChecker };
