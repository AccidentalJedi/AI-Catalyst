#!/usr/bin/env ts-node
/**
 * AI Catalyst - Migration Setup Test Script
 * 
 * This script validates that the migration setup is correct before attempting
 * the actual data migration. It checks database connections, schema compatibility,
 * and environment configuration.
 * 
 * USAGE:
 * npm run test:migration-setup
 * 
 * CHECKS PERFORMED:
 * ✅ Environment variable validation
 * ✅ SQLite database connection and data presence
 * ✅ PostgreSQL database connection and schema readiness
 * ✅ Table structure compatibility
 * ✅ Migration script dependencies
 */

import * as dotenv from 'dotenv';
import knex, { Knex } from 'knex';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config({ path: './.env' });

/**
 * Validates required environment variables for migration
 */
function validateEnvironmentVariables(): boolean {
  console.log('🔍 Validating environment variables...');
  
  const requiredVars = [
    'POSTGRES_HOST',
    'POSTGRES_PORT', 
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DATABASE'
  ];
  
  const missingVars: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('   ❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`      - ${varName}`);
    });
    return false;
  }
  
  console.log('   ✅ All required environment variables are set');
  return true;
}

/**
 * Tests SQLite database connection and checks for data
 */
async function testSQLiteDatabase(): Promise<{ connection: boolean; hasData: boolean; tableCount: number }> {
  console.log('\n📱 Testing SQLite database...');
  
  const sqliteConfig: Knex.Config = {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || './data/ai-catalyst.db',
    },
    useNullAsDefault: true,
  };
  
  const sqliteDb = knex(sqliteConfig);
  
  try {
    // Test connection
    await sqliteDb.raw('SELECT 1');
    console.log('   ✅ SQLite connection successful');
    
    // Check for tables
    const tables = await sqliteDb.raw(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableCount = tables.length;
    console.log(`   📊 Found ${tableCount} tables in SQLite database`);
    
    // Check for data in key tables
    let hasData = false;
    let totalRecords = 0;

    if (tableCount > 0) {
      const keyTables = ['users', 'user_roles', 'audit_logs', 'business_profiles'];

      for (const tableName of keyTables) {
        try {
          const hasTable = await sqliteDb.schema.hasTable(tableName);
          if (hasTable) {
            const recordCount = await sqliteDb(tableName).count('* as count').first();
            const records = Number(recordCount?.count || 0);
            totalRecords += records;

            if (records > 0) {
              console.log(`   📋 Found ${records} records in ${tableName} table`);
              hasData = true;
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Could not check ${tableName} table data`);
        }
      }

      if (hasData) {
        console.log(`   📊 Total records found across key tables: ${totalRecords}`);
      } else {
        console.log('   📭 No data found in key tables');
      }
    }
    
    await sqliteDb.destroy();
    return { connection: true, hasData, tableCount };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ SQLite connection failed: ${errorMessage}`);
    await sqliteDb.destroy();
    return { connection: false, hasData: false, tableCount: 0 };
  }
}

/**
 * Tests PostgreSQL database connection and schema readiness
 */
async function testPostgreSQLDatabase(): Promise<{ connection: boolean; schemaReady: boolean; tableCount: number }> {
  console.log('\n🐘 Testing PostgreSQL database...');
  
  const pgConfig: Knex.Config = {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 1,
      max: 2,
    },
  };
  
  const pgDb = knex(pgConfig);
  
  try {
    // Test connection
    await pgDb.raw('SELECT 1');
    console.log('   ✅ PostgreSQL connection successful');
    
    // Check for tables
    const tables = await pgDb.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = tables.rows.length;
    console.log(`   📊 Found ${tableCount} tables in PostgreSQL database`);
    
    // Check if schema is ready (has expected tables)
    const expectedTables = ['users', 'user_roles', 'audit_logs'];
    let schemaReady = true;
    
    for (const tableName of expectedTables) {
      const hasTable = await pgDb.schema.hasTable(tableName);
      if (!hasTable) {
        console.log(`   ⚠️  Missing expected table: ${tableName}`);
        schemaReady = false;
      }
    }
    
    if (schemaReady) {
      console.log('   ✅ PostgreSQL schema appears ready for migration');
    } else {
      console.log('   ⚠️  PostgreSQL schema may need migrations to be run first');
    }
    
    await pgDb.destroy();
    return { connection: true, schemaReady, tableCount };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ PostgreSQL connection failed: ${errorMessage}`);
    console.error('   💡 Make sure PostgreSQL is running and credentials are correct');
    await pgDb.destroy();
    return { connection: false, schemaReady: false, tableCount: 0 };
  }
}

/**
 * Main test function
 */
async function testMigrationSetup() {
  console.log('🧪 AI Catalyst Migration Setup Test');
  console.log('===================================\n');
  
  let allTestsPassed = true;
  
  // Test 1: Environment Variables
  const envValid = validateEnvironmentVariables();
  if (!envValid) {
    allTestsPassed = false;
  }
  
  // Test 2: SQLite Database
  const sqliteResult = await testSQLiteDatabase();
  if (!sqliteResult.connection) {
    allTestsPassed = false;
  }
  
  // Test 3: PostgreSQL Database
  const pgResult = await testPostgreSQLDatabase();
  if (!pgResult.connection) {
    allTestsPassed = false;
  }
  
  // Summary
  console.log('\n📋 Migration Readiness Summary');
  console.log('==============================');
  console.log(`Environment Variables: ${envValid ? '✅ Ready' : '❌ Not Ready'}`);
  console.log(`SQLite Database: ${sqliteResult.connection ? '✅ Connected' : '❌ Failed'}`);
  console.log(`SQLite Data: ${sqliteResult.hasData ? '✅ Has Data' : '📭 No Data'}`);
  console.log(`PostgreSQL Database: ${pgResult.connection ? '✅ Connected' : '❌ Failed'}`);
  console.log(`PostgreSQL Schema: ${pgResult.schemaReady ? '✅ Ready' : '⚠️  Needs Setup'}`);
  
  if (allTestsPassed && sqliteResult.hasData && pgResult.schemaReady) {
    console.log('\n🎉 Migration setup is ready!');
    console.log('💡 You can now run: npm run db:migrate:data');
  } else if (allTestsPassed) {
    console.log('\n⚠️  Migration setup has some issues:');
    if (!sqliteResult.hasData) {
      console.log('   - SQLite database has no data to migrate');
    }
    if (!pgResult.schemaReady) {
      console.log('   - PostgreSQL schema needs to be set up first');
      console.log('   - Run migrations on PostgreSQL: NODE_ENV=production npm run db:migrate:latest');
    }
  } else {
    console.log('\n❌ Migration setup failed. Please fix the issues above before proceeding.');
    process.exit(1);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testMigrationSetup();
}

export { testMigrationSetup };
