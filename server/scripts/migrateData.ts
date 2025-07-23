#!/usr/bin/env ts-node
/**
 * AI Catalyst - Data Migration Script (SQLite to PostgreSQL)
 *
 * This script migrates all data from the SQLite database to a PostgreSQL database.
 * It's designed as a one-time utility to facilitate the move to a production environment.
 *
 * FEATURES:
 * ✅ Dependency-aware table migration order
 * ✅ Batch processing for performance
 * ✅ Transaction safety for data integrity
 * ✅ Comprehensive error handling and logging
 * ✅ Connection validation before migration
 * ✅ Progress tracking and detailed reporting
 *
 * USAGE:
 * 1. Ensure your .env file has configurations for BOTH database types
 * 2. Ensure PostgreSQL database exists and migrations have been run
 * 3. Run the script: npm run db:migrate:data
 * 4. Optional: Use --clean-destination flag to clear existing data in PostgreSQL tables
 *
 * PRE-REQUISITES:
 * - A running and accessible PostgreSQL instance
 * - The PostgreSQL database schema must already be created (run migrations first)
 * - Environment variables for PostgreSQL must be set in your .env file
 * - SQLite database with data to migrate
 *
 * SAFETY FEATURES:
 * - Validates both database connections before starting
 * - Uses transactions for atomic operations
 * - Batch processing to handle large datasets
 * - Comprehensive error reporting and rollback
 */

import * as dotenv from 'dotenv';
import knex, { Knex } from 'knex';
import { dbLogger } from '../src/utils/logger';

// Load environment variables from .env file
dotenv.config({ path: './.env' });

// List of tables to migrate in order of dependency (most important first)
// This order ensures foreign key constraints are respected
const tablesToMigrate = [
  // Core user and authentication tables
  'users',
  'user_roles', 
  'user_sessions',
  'notification_preferences',
  
  // Veteran and verification tables
  'veteran_verification',
  
  // Business and document tables
  'business_profiles',
  'business_formation_workflows',
  'documents',
  'document_templates',
  
  // Grant and opportunity tables
  'grant_opportunities',
  'grant_matches',
  'grant_applications',
  
  // System and audit tables
  'audit_logs',
  'system_settings',
  'compliance_tracking',
  
  // Add other tables here as they are created
];

// --- Command-line argument parsing ---
const args = process.argv.slice(2);
const cleanDestination = args.includes('--clean-destination');

const BATCH_SIZE = 100; // Number of records to insert at a time
const MAX_RETRIES = 3; // Maximum retry attempts for failed operations

/**
 * Validates database connections and schema compatibility
 */
async function validateDatabases(sqliteDb: Knex, pgDb: Knex): Promise<void> {
  console.log('🔍 Validating database connections and schema...');
  
  // Test SQLite connection
  try {
    await sqliteDb.raw('SELECT 1');
    console.log('   ✅ SQLite connection successful');
  } catch (error) {
    throw new Error(`SQLite connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Test PostgreSQL connection
  try {
    await pgDb.raw('SELECT 1');
    console.log('   ✅ PostgreSQL connection successful');
  } catch (error) {
    throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Validate that required tables exist in both databases
  for (const table of tablesToMigrate) {
    try {
      // Check if table exists in SQLite
      const sqliteTableExists = await sqliteDb.schema.hasTable(table);
      
      // Check if table exists in PostgreSQL
      const pgTableExists = await pgDb.schema.hasTable(table);
      
      if (sqliteTableExists && !pgTableExists) {
        console.log(`   ⚠️  Table '${table}' exists in SQLite but not in PostgreSQL - skipping`);
      } else if (!sqliteTableExists) {
        console.log(`   ℹ️  Table '${table}' does not exist in SQLite - skipping`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not validate table '${table}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Migrates data for a single table with retry logic
 * @returns 'success' if migration completed, 'skipped' if table was skipped
 */
async function migrateTable(
  tableName: string,
  sqliteDb: Knex,
  pgDb: Knex,
  retryCount: number = 0
): Promise<'success' | 'skipped'> {
  try {
    console.log(`\n📋 Migrating table: ${tableName}...`);
    
    // Check if table exists in both databases
    const sqliteTableExists = await sqliteDb.schema.hasTable(tableName);
    const pgTableExists = await pgDb.schema.hasTable(tableName);
    
    if (!sqliteTableExists) {
      console.log(`   ⏭️  Table '${tableName}' does not exist in SQLite - skipping`);
      return 'skipped';
    }

    if (!pgTableExists) {
      console.log(`   ⏭️  Table '${tableName}' does not exist in PostgreSQL - skipping`);
      return 'skipped';
    }
    
    // Get total record count from source
    const recordCountResult = await sqliteDb(tableName).count('* as count').first();
    const totalRecords = Number(recordCountResult?.count || 0);
    
    if (totalRecords === 0) {
      console.log(`   📭 No records to migrate for table '${tableName}' - skipping`);
      return 'skipped';
    }
    
    console.log(`   📊 Found ${totalRecords} records to migrate`);
    
    // Check if destination table already has data
    const pgRecordCountResult = await pgDb(tableName).count('* as count').first();
    const pgRecordCount = Number(pgRecordCountResult?.count || 0);
    
    if (pgRecordCount > 0) {
      if (cleanDestination) {
        console.log(`   ⚠️  Destination table '${tableName}' already contains ${pgRecordCount} records.`);
        console.log(`   🔄 Clearing destination table as per --clean-destination flag...`);
        await pgDb(tableName).del();
      } else {
        console.log(`   ⚠️  Destination table '${tableName}' already contains ${pgRecordCount} records. Skipping migration for this table to prevent data loss.`);
        console.log(`   💡 Use the --clean-destination flag to force clearing the destination table.`);
        return 'skipped';
      }
    }
    
    // Fetch all data from the source table
    // NOTE: For extremely large tables (millions of rows), this could cause memory issues.
    // A more robust solution for massive datasets would be to use streams or paginated queries
    // from the source database to process data chunk by chunk without loading everything into memory.
    const data = await sqliteDb(tableName).select('*');

    if (data.length === 0) {
      console.log(`   📭 No data retrieved from table '${tableName}' - skipping`);
      return 'skipped';
    }
    
    // Use a transaction on the destination DB for safety
    await pgDb.transaction(async (trx) => {
      console.log(`   🔄 Inserting ${data.length} records in batches of ${BATCH_SIZE}...`);
      
      // Process data in batches for better performance and memory management
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(data.length / BATCH_SIZE);
        
        console.log(`     📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
        
        try {
          await trx.batchInsert(tableName, batch, BATCH_SIZE);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`     ❌ Batch ${batchNumber} failed: ${errorMessage}`);
          throw error; // This will trigger transaction rollback
        }
      }
    });
    
    // Verify migration success
    const finalPgCount = await pgDb(tableName).count('* as count').first();
    const finalCount = Number(finalPgCount?.count || 0);
    
    if (finalCount === totalRecords) {
      console.log(`   ✅ Successfully migrated ${finalCount} records for table '${tableName}'`);
    } else {
      throw new Error(`Migration verification failed: expected ${totalRecords}, got ${finalCount}`);
    }

    return 'success';
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (retryCount < MAX_RETRIES) {
      console.log(`   🔄 Retrying migration for table '${tableName}' (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return await migrateTable(tableName, sqliteDb, pgDb, retryCount + 1);
    } else {
      console.error(`   ❌ Failed to migrate table '${tableName}' after ${MAX_RETRIES} attempts: ${errorMessage}`);
      throw error;
    }
  }
}

/**
 * Main migration function
 */
async function migrateData() {
  console.log('🚀 AI Catalyst Data Migration: SQLite → PostgreSQL');
  console.log('================================================');

  if (cleanDestination) {
    console.log('⚠️  CLEAN DESTINATION MODE: Will clear existing data in PostgreSQL tables');
  } else {
    console.log('🛡️  SAFE MODE: Will skip tables with existing data (use --clean-destination to override)');
  }
  console.log('');
  
  const startTime = Date.now();
  
  // --- SOURCE DATABASE (SQLite) ---
  const sqliteConfig: Knex.Config = {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || './data/ai-catalyst.db',
    },
    useNullAsDefault: true,
    acquireConnectionTimeout: 10000,
  };
  const sqliteDb = knex(sqliteConfig);
  
  // --- DESTINATION DATABASE (PostgreSQL) ---
  const pgConfig: Knex.Config = {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 10000,
    },
  };
  const pgDb = knex(pgConfig);
  
  try {
    // Validate database connections and schema
    await validateDatabases(sqliteDb, pgDb);
    
    console.log('\n🔄 Beginning data migration...');
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Migrate each table in dependency order
    for (const table of tablesToMigrate) {
      try {
        const status = await migrateTable(table, sqliteDb, pgDb);
        if (status === 'success') {
          successCount++;
        } else {
          skipCount++;
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        dbLogger.error(`Table migration failed for ${table}:`, { error: errorMessage });
        console.error(`❌ Failed to migrate table '${table}': ${errorMessage}`);

        // Continue with other tables unless it's a critical failure
        if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          throw error; // Critical failure - stop migration
        }
      }
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 Data Migration Summary');
    console.log('========================');
    console.log(`✅ Successfully migrated: ${successCount} tables`);
    console.log(`⏭️  Skipped: ${skipCount} tables`);
    console.log(`❌ Failed: ${errorCount} tables`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    
    if (errorCount === 0) {
      console.log('\n🎊 Migration completed successfully! Your data is now in PostgreSQL.');
      console.log('💡 Next steps:');
      console.log('   1. Update DATABASE_TYPE=postgresql in your .env file');
      console.log('   2. Test your application with the new database');
      console.log('   3. Update production environment variables');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the logs.');
      process.exit(1);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.error('Data migration failed:', { 
      error: errorMessage, 
      stack: (error as Error).stack 
    });
    
    console.error('\n💥 Data migration failed!');
    console.error('========================');
    console.error(`Error: ${errorMessage}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your PostgreSQL connection settings');
    console.error('   2. Ensure PostgreSQL database exists and migrations have been run');
    console.error('   3. Verify environment variables are correctly set');
    console.error('   4. Check logs/db.log for detailed error information');
    
    process.exit(1);
  } finally {
    // Clean up database connections
    console.log('\n🔌 Closing database connections...');
    try {
      await sqliteDb.destroy();
      await pgDb.destroy();
      console.log('   ✅ Database connections closed');
    } catch (error) {
      console.error('   ⚠️  Error closing connections:', error);
    }
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateData();
}

export { migrateData };
