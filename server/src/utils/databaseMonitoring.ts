import { Pool } from 'pg';
import { dbLogger } from '@utils/logger';
import { getPostgresPool, checkPostgresDatabaseHealth } from '@utils/postgresDatabase';
import { DatabaseAdapterFactory } from '@utils/databaseAdapter';

// Database health check result interface
export interface DatabaseHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime: number;
  details: {
    connection: boolean;
    query: boolean;
    poolStats?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
    error?: string;
  };
}

// Database performance metrics interface
export interface DatabaseMetrics {
  timestamp: Date;
  databaseType: 'sqlite' | 'postgresql';
  connectionPool?: {
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    maxConnections: number;
  };
  queryPerformance: {
    averageResponseTime: number;
    slowQueries: number;
    totalQueries: number;
  };
  errors: {
    connectionErrors: number;
    queryErrors: number;
    timeoutErrors: number;
  };
}

// Performance tracking
class DatabasePerformanceTracker {
  private queryTimes: number[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private maxQueryTimeHistory = 100;
  private errorCounts = {
    connection: 0,
    query: 0,
    timeout: 0
  };

  recordQueryTime(timeMs: number): void {
    this.queryTimes.push(timeMs);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }
  }

  recordError(type: 'connection' | 'query' | 'timeout'): void {
    this.errorCounts[type]++;
  }

  getAverageResponseTime(): number {
    if (this.queryTimes.length === 0) return 0;
    return this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  getSlowQueryCount(): number {
    return this.queryTimes.filter(time => time > this.slowQueryThreshold).length;
  }

  getTotalQueryCount(): number {
    return this.queryTimes.length;
  }

  getErrorCounts() {
    return { ...this.errorCounts };
  }

  reset(): void {
    this.queryTimes = [];
    this.errorCounts = { connection: 0, query: 0, timeout: 0 };
  }
}

// Global performance tracker instance
const performanceTracker = new DatabasePerformanceTracker();

// PostgreSQL-specific health check
export const checkPostgreSQLHealth = async (): Promise<DatabaseHealthCheck> => {
  const startTime = Date.now();
  const result: DatabaseHealthCheck = {
    status: 'healthy',
    timestamp: new Date(),
    responseTime: 0,
    details: {
      connection: false,
      query: false
    }
  };

  try {
    const pool = getPostgresPool();
    
    // Test connection
    const client = await pool.connect();
    result.details.connection = true;
    
    try {
      // Test query
      await client.query('SELECT 1 as health_check');
      result.details.query = true;
      
      // Get pool statistics
      result.details.poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
      
    } finally {
      client.release();
    }
    
    result.responseTime = Date.now() - startTime;
    performanceTracker.recordQueryTime(result.responseTime);
    
    // Determine status based on response time and pool health
    if (result.responseTime > 5000) { // 5 seconds
      result.status = 'degraded';
    } else if (result.details.poolStats && result.details.poolStats.waitingCount > 5) {
      result.status = 'degraded';
    }
    
  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.details.error = error instanceof Error ? error.message : 'Unknown error';
    performanceTracker.recordError('connection');
    
    dbLogger.error('PostgreSQL health check failed:', {
      error: result.details.error,
      responseTime: result.responseTime
    });
  }

  return result;
};

// SQLite-specific health check using unified adapter
export const checkSQLiteHealth = (): DatabaseHealthCheck => {
  const startTime = Date.now();
  const result: DatabaseHealthCheck = {
    status: 'healthy',
    timestamp: new Date(),
    responseTime: 0,
    details: {
      connection: false,
      query: false
    }
  };

  try {
    // Use unified database adapter for health check
    const adapter = DatabaseAdapterFactory.getAdapter();
    const isHealthy = adapter ? true : false;
    result.details.connection = true;
    result.details.query = isHealthy;
    result.responseTime = Date.now() - startTime;
    
    if (!isHealthy) {
      result.status = 'unhealthy';
    }
    
    performanceTracker.recordQueryTime(result.responseTime);
    
  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.details.error = error instanceof Error ? error.message : 'Unknown error';
    performanceTracker.recordError('query');
    
    dbLogger.error('SQLite health check failed:', {
      error: result.details.error,
      responseTime: result.responseTime
    });
  }

  return result;
};

// Unified health check
export const checkDatabaseHealth = async (): Promise<DatabaseHealthCheck> => {
  const databaseType = DatabaseAdapterFactory.getDatabaseType();
  
  if (databaseType === 'postgresql') {
    return await checkPostgreSQLHealth();
  } else {
    return checkSQLiteHealth();
  }
};

// Get database performance metrics
export const getDatabaseMetrics = async (): Promise<DatabaseMetrics> => {
  const databaseType = DatabaseAdapterFactory.getDatabaseType();
  const errorCounts = performanceTracker.getErrorCounts();
  
  const metrics: DatabaseMetrics = {
    timestamp: new Date(),
    databaseType: databaseType === 'pg' ? 'postgresql' : 'sqlite' as 'sqlite' | 'postgresql',
    queryPerformance: {
      averageResponseTime: performanceTracker.getAverageResponseTime(),
      slowQueries: performanceTracker.getSlowQueryCount(),
      totalQueries: performanceTracker.getTotalQueryCount()
    },
    errors: {
      connectionErrors: errorCounts.connection,
      queryErrors: errorCounts.query,
      timeoutErrors: errorCounts.timeout
    }
  };

  // Add PostgreSQL-specific metrics
  if (databaseType === 'postgresql') {
    try {
      const pool = getPostgresPool();
      metrics.connectionPool = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
        maxConnections: parseInt(process.env.POSTGRES_POOL_MAX || '20')
      };
    } catch (error) {
      dbLogger.error('Failed to get PostgreSQL pool metrics:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return metrics;
};

// Database monitoring service
export class DatabaseMonitoringService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // Start monitoring
  start(healthCheckIntervalMs = 30000, metricsIntervalMs = 60000): void {
    if (this.isMonitoring) {
      dbLogger.warn('Database monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    
    // Health check monitoring
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await checkDatabaseHealth();
        
        if (health.status === 'unhealthy') {
          dbLogger.error('Database health check failed:', health);
        } else if (health.status === 'degraded') {
          dbLogger.warn('Database performance degraded:', health);
        } else {
          dbLogger.debug('Database health check passed:', {
            responseTime: health.responseTime,
            poolStats: health.details.poolStats
          });
        }
      } catch (error) {
        dbLogger.error('Health check monitoring error:', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, healthCheckIntervalMs);

    // Metrics monitoring
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await getDatabaseMetrics();
        
        dbLogger.info('Database metrics:', {
          databaseType: metrics.databaseType,
          avgResponseTime: metrics.queryPerformance.averageResponseTime,
          slowQueries: metrics.queryPerformance.slowQueries,
          totalQueries: metrics.queryPerformance.totalQueries,
          connectionPool: metrics.connectionPool,
          errors: metrics.errors
        });
        
        // Alert on high error rates
        const totalErrors = metrics.errors.connectionErrors + metrics.errors.queryErrors + metrics.errors.timeoutErrors;
        if (totalErrors > 10) {
          dbLogger.warn('High database error rate detected:', metrics.errors);
        }
        
      } catch (error) {
        dbLogger.error('Metrics monitoring error:', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, metricsIntervalMs);

    dbLogger.info('Database monitoring started', {
      healthCheckInterval: healthCheckIntervalMs,
      metricsInterval: metricsIntervalMs
    });
  }

  // Stop monitoring
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    this.isMonitoring = false;
    dbLogger.info('Database monitoring stopped');
  }

  // Get monitoring status
  isRunning(): boolean {
    return this.isMonitoring;
  }

  // Reset performance metrics
  resetMetrics(): void {
    performanceTracker.reset();
    dbLogger.info('Database performance metrics reset');
  }
}

// Export singleton monitoring service
export const databaseMonitoring = new DatabaseMonitoringService();

// Export performance tracker for use in database utilities
export { performanceTracker };
