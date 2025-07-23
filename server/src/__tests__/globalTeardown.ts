/**
 * @file Global Test Teardown
 * Runs once after all tests to clean up test environment
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { DatabaseAdapterFactory } from '../utils/databaseAdapter';

async function cleanupTestDatabase() {
  const databaseType = process.env.DATABASE_TYPE || 'postgresql';

  if (databaseType === 'postgresql') {
    console.log('🧹 Cleaning up PostgreSQL test database...');

    try {
      // Close any open connections
      await DatabaseAdapterFactory.close();

      // Optionally drop test database (uncomment if needed)
      // const adminPool = new Pool({
      //   host: process.env.POSTGRES_HOST || 'localhost',
      //   port: parseInt(process.env.POSTGRES_PORT || '5432'),
      //   database: 'postgres',
      //   user: process.env.POSTGRES_USER || 'ai_catalyst_test_user',
      //   password: process.env.POSTGRES_PASSWORD || 'test_password',
      //   ssl: false
      // });

      // const testDbName = process.env.POSTGRES_DATABASE || 'ai_catalyst_test';
      // await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
      // await adminPool.end();

      console.log('✅ PostgreSQL test database cleanup complete');
    } catch (error) {
      console.warn('⚠️ PostgreSQL cleanup warning:', error);
    }
  } else {
    // Clean up SQLite test database
    const dbPath = process.env.DATABASE_PATH || './data/test-ai-catalyst.db';
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ SQLite test database removed');
    }
  }
}

async function cleanupTempFiles() {
  // Clean up any temporary test files
  const tempDirs = [
    './data/test-uploads',
    './data/test-documents',
    './logs/test'
  ];

  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️ Removed temp directory: ${dir}`);
    }
  }
}

export default async function globalTeardown() {
  console.log('🧹 Cleaning up AI Catalyst Backend test environment...');

  // Clean up test database
  await cleanupTestDatabase();

  // Clean up any temporary files
  await cleanupTempFiles();

  console.log('✅ Test environment cleanup complete');
}
