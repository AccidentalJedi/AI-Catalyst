import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { databaseConfig } from '@config/index';
import { dbLogger } from '@utils/logger';

// Database instance
let db: Database.Database | null = null;

// Database connection options
const dbOptions: Database.Options = {
  verbose: databaseConfig.options.verbose,
  fileMustExist: databaseConfig.options.fileMustExist,
  timeout: databaseConfig.options.timeout
};

// Initialize database connection
export const initializeDatabase = (): Database.Database => {
  try {
    // Ensure database directory exists
    const dbDir = path.dirname(databaseConfig.filename);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      dbLogger.info(`Created database directory: ${dbDir}`);
    }

    // Create database connection
    db = new Database(databaseConfig.filename, dbOptions);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Set synchronous mode for better performance
    db.pragma('synchronous = NORMAL');
    
    // Set cache size (in KB)
    db.pragma('cache_size = 10000');
    
    // Set temp store to memory
    db.pragma('temp_store = MEMORY');
    
    dbLogger.info('Database connection established successfully', {
      filename: databaseConfig.filename,
      mode: db.pragma('journal_mode', { simple: true }),
      foreignKeys: db.pragma('foreign_keys', { simple: true }),
      cacheSize: db.pragma('cache_size', { simple: true })
    });

    return db;
  } catch (error) {
    dbLogger.error('Failed to initialize database:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename: databaseConfig.filename
    });
    throw error;
  }
};

// Get database instance
export const getDatabase = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

// Close database connection
export const closeDatabase = (): void => {
  if (db) {
    try {
      db.close();
      db = null;
      dbLogger.info('Database connection closed successfully');
    } catch (error) {
      dbLogger.error('Error closing database:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

// Database health check
export const checkDatabaseHealth = (): boolean => {
  try {
    if (!db) return false;
    
    // Simple query to check if database is responsive
    const result = db.prepare('SELECT 1 as health').get();
    return result && (result as any).health === 1;
  } catch (error) {
    dbLogger.error('Database health check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

// Transaction wrapper
export const transaction = <T>(fn: (db: Database.Database) => T): T => {
  const database = getDatabase();
  const txn = database.transaction(fn);
  return txn(database);
};

// Prepared statement cache
const statementCache = new Map<string, Database.Statement>();

// Get or create prepared statement
export const getStatement = (sql: string): Database.Statement => {
  if (statementCache.has(sql)) {
    return statementCache.get(sql)!;
  }
  
  const database = getDatabase();
  const statement = database.prepare(sql);
  statementCache.set(sql, statement);
  return statement;
};

// Clear statement cache
export const clearStatementCache = (): void => {
  statementCache.clear();
  dbLogger.info('Statement cache cleared');
};

// Database utilities
export const dbUtils = {
  // Execute a query and return all results
  all: <T = any>(sql: string, params?: any): T[] => {
    const stmt = getStatement(sql);
    return stmt.all(params) as T[];
  },

  // Execute a query and return first result
  get: <T = any>(sql: string, params?: any): T | undefined => {
    const stmt = getStatement(sql);
    return stmt.get(params) as T | undefined;
  },

  // Execute a query and return info about changes
  run: (sql: string, params?: any): Database.RunResult => {
    const stmt = getStatement(sql);
    return stmt.run(params);
  },

  // Execute multiple statements in a transaction
  batch: (statements: Array<{ sql: string; params?: any }>): void => {
    transaction((db) => {
      for (const { sql, params } of statements) {
        const stmt = getStatement(sql);
        stmt.run(params);
      }
    });
  },

  // Get table info
  getTableInfo: (tableName: string) => {
    return dbUtils.all(`PRAGMA table_info(${tableName})`);
  },

  // Check if table exists
  tableExists: (tableName: string): boolean => {
    const result = dbUtils.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!result;
  },

  // Get database size in bytes
  getDatabaseSize: (): number => {
    const result = dbUtils.get('PRAGMA page_count') as { page_count: number };
    const pageSize = dbUtils.get('PRAGMA page_size') as { page_size: number };
    return result.page_count * pageSize.page_size;
  },

  // Vacuum database
  vacuum: (): void => {
    const database = getDatabase();
    database.exec('VACUUM');
    dbLogger.info('Database vacuumed successfully');
  },

  // Analyze database
  analyze: (): void => {
    const database = getDatabase();
    database.exec('ANALYZE');
    dbLogger.info('Database analyzed successfully');
  },

  // Get database statistics
  getStats: () => {
    const database = getDatabase();
    return {
      size: dbUtils.getDatabaseSize(),
      pageCount: dbUtils.get('PRAGMA page_count'),
      pageSize: dbUtils.get('PRAGMA page_size'),
      journalMode: database.pragma('journal_mode', { simple: true }),
      foreignKeys: database.pragma('foreign_keys', { simple: true }),
      cacheSize: database.pragma('cache_size', { simple: true }),
      tempStore: database.pragma('temp_store', { simple: true })
    };
  }
};

// Error handling for database operations
export const handleDatabaseError = (error: any, operation: string): never => {
  dbLogger.error(`Database operation failed: ${operation}`, {
    error: error instanceof Error ? error.message : 'Unknown error',
    code: error.code,
    errno: error.errno
  });
  
  // Re-throw with more context
  throw new Error(`Database ${operation} failed: ${error.message}`);
};

// Database backup utility
export const backupDatabase = (backupPath: string): void => {
  try {
    const database = getDatabase();
    database.backup(backupPath);
    dbLogger.info(`Database backed up successfully to: ${backupPath}`);
  } catch (error) {
    dbLogger.error('Database backup failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      backupPath
    });
    throw error;
  }
};

// Export database instance getter for direct access when needed
export { db as databaseInstance };


