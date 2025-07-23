import { Pool, PoolClient, QueryResult } from 'pg';
import { postgresConfig } from '@config/index';
import { dbLogger } from '@utils/logger';

// PostgreSQL connection pool
let pool: Pool | null = null;

// Database connection options
const poolConfig = {
  connectionString: postgresConfig.connectionString,
  host: postgresConfig.host,
  port: postgresConfig.port,
  database: postgresConfig.database,
  user: postgresConfig.user,
  password: postgresConfig.password,
  ssl: postgresConfig.ssl,
  min: postgresConfig.pool.min,
  max: postgresConfig.pool.max,
  idleTimeoutMillis: postgresConfig.pool.idleTimeoutMillis,
  connectionTimeoutMillis: postgresConfig.pool.connectionTimeoutMillis,
};

// Initialize PostgreSQL connection pool
export const initializePostgresDatabase = (): Pool => {
  try {
    if (pool) {
      return pool;
    }

    // Create connection pool
    pool = new Pool(poolConfig);
    
    // Handle pool events
    pool.on('connect', (client: PoolClient) => {
      dbLogger.info('PostgreSQL client connected', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount
      });
    });

    pool.on('error', (err: Error) => {
      dbLogger.error('PostgreSQL pool error:', {
        error: err.message,
        stack: err.stack
      });
    });

    pool.on('remove', () => {
      dbLogger.info('PostgreSQL client removed from pool', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount
      });
    });
    
    dbLogger.info('PostgreSQL connection pool established successfully', {
      host: postgresConfig.host,
      port: postgresConfig.port,
      database: postgresConfig.database,
      user: postgresConfig.user,
      poolMin: postgresConfig.pool.min,
      poolMax: postgresConfig.pool.max
    });

    return pool;
  } catch (error) {
    dbLogger.error('Failed to initialize PostgreSQL connection pool:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        host: postgresConfig.host,
        port: postgresConfig.port,
        database: postgresConfig.database,
        user: postgresConfig.user
      }
    });
    throw error;
  }
};

// Get database pool instance
export const getPostgresPool = (): Pool => {
  if (!pool) {
    return initializePostgresDatabase();
  }
  return pool;
};

// Close database connection pool
export const closePostgresDatabase = async (): Promise<void> => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      dbLogger.info('PostgreSQL connection pool closed successfully');
    } catch (error) {
      dbLogger.error('Error closing PostgreSQL connection pool:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
};

// PostgreSQL health check
export const checkPostgresDatabaseHealth = async (): Promise<boolean> => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch (error) {
    dbLogger.error('PostgreSQL health check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

// Transaction wrapper for PostgreSQL
export const postgresTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getPostgresPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    dbLogger.error('PostgreSQL transaction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  } finally {
    client.release();
  }
};

// Prepared statement cache for PostgreSQL
const postgresStatementCache = new Map<string, string>();

// PostgreSQL database utilities
export const postgresDbUtils = {
  // Execute a query and return all results
  all: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
    const pool = getPostgresPool();
    try {
      const result: QueryResult = await pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      dbLogger.error('PostgreSQL query failed (all):', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  // Execute a query and return first result
  get: async <T = any>(sql: string, params?: any[]): Promise<T | undefined> => {
    const pool = getPostgresPool();
    try {
      const result: QueryResult = await pool.query(sql, params);
      return result.rows[0] as T | undefined;
    } catch (error) {
      dbLogger.error('PostgreSQL query failed (get):', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  // Execute a query and return info about changes
  run: async (sql: string, params?: any[]): Promise<QueryResult> => {
    const pool = getPostgresPool();
    try {
      const result: QueryResult = await pool.query(sql, params);
      return result;
    } catch (error) {
      dbLogger.error('PostgreSQL query failed (run):', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  // Execute multiple queries in a transaction
  batch: async (queries: Array<{ sql: string; params?: any[] }>): Promise<QueryResult[]> => {
    return await postgresTransaction(async (client) => {
      const results: QueryResult[] = [];
      for (const query of queries) {
        const result = await client.query(query.sql, query.params);
        results.push(result);
      }
      return results;
    });
  },

  // Get connection pool statistics
  getPoolStats: () => {
    const pool = getPostgresPool();
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
};

// Clear statement cache
export const clearPostgresStatementCache = (): void => {
  postgresStatementCache.clear();
  dbLogger.info('PostgreSQL statement cache cleared');
};

// Database connection info
export const getPostgresConnectionInfo = () => {
  return {
    host: postgresConfig.host,
    port: postgresConfig.port,
    database: postgresConfig.database,
    user: postgresConfig.user,
    poolConfig: {
      min: postgresConfig.pool.min,
      max: postgresConfig.pool.max,
      idleTimeoutMillis: postgresConfig.pool.idleTimeoutMillis,
      connectionTimeoutMillis: postgresConfig.pool.connectionTimeoutMillis
    }
  };
};
