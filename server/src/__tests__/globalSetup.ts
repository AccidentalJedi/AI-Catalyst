/**
 * @file Global Test Setup
 * Runs once before all tests to initialize test environment
 */

import { Pool } from 'pg';
import { DatabaseAdapterFactory } from '../utils/databaseAdapter';

async function initializeTestDatabase() {
  const databaseType = process.env.DATABASE_TYPE || 'postgresql';

  if (databaseType === 'postgresql') {
    console.log('🔧 Initializing PostgreSQL test database...');

    try {
      // Create test database if it doesn't exist
      const adminPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: 'postgres', // Connect to default database
        user: process.env.POSTGRES_USER || 'ai_catalyst_test_user',
        password: process.env.POSTGRES_PASSWORD || 'test_password',
        ssl: false
      });

      const testDbName = process.env.POSTGRES_DATABASE || 'ai_catalyst_test';

      // Check if test database exists
      const dbExists = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [testDbName]
      );

      if (dbExists.rows.length === 0) {
        console.log(`Creating test database: ${testDbName}`);
        await adminPool.query(`CREATE DATABASE "${testDbName}"`);
      }

      await adminPool.end();

      // Initialize schema using the migration system
      const { DatabaseMigrator } = await import('../../scripts/migrate');
      const migrator = new DatabaseMigrator();
      await migrator.migrateUp();
      await migrator.close();

      console.log('✅ PostgreSQL test database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL test database:', error);
      // Fall back to SQLite for tests
      process.env.DATABASE_TYPE = 'sqlite';
      process.env.DATABASE_PATH = './data/test-ai-catalyst.db';
      console.log('🔄 Falling back to SQLite for tests');
    }
  } else {
    console.log('🔧 Using SQLite for tests');
  }
}

export default async function globalSetup() {
  console.log('🧪 Setting up AI Catalyst Backend test environment...');

  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

  // Initialize test database
  await initializeTestDatabase();

  console.log('✅ Test environment setup complete');
}
