import knex, { Knex } from 'knex';
import path from 'path';

// Import knexfile configuration
const knexfilePath = path.resolve(__dirname, '../../../knexfile.cjs');
const knexConfig = require(knexfilePath);

/**
 * A factory class for creating and managing the database connection.
 * This ensures a single, consistent Knex instance (singleton pattern) is used
 * throughout the application.
 */
class DatabaseAdapterFactory {
  private static adapter: Knex;
  private static isInitialized: boolean = false;

  /**
   * Initializes the database connection based on the current environment.
   * This method should be called once when the application starts.
   * @throws {Error} if the configuration for the environment is not found.
   * @throws {Error} if the database connection fails.
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized && this.adapter) {
      console.log('Database adapter is already initialized.');
      return;
    }

    const environment = process.env.NODE_ENV || 'development';
    const configOptions = knexConfig[environment];

    if (!configOptions) {
      throw new Error(`Knex configuration for environment '${environment}' not found.`);
    }

    console.log(`Initializing database adapter for '${environment}' environment...`);

    try {
      this.adapter = knex(configOptions);

      // Test the connection to ensure it's valid
      await this.adapter.raw('SELECT 1');
      this.isInitialized = true;

      console.log('✅ Database connection successful.');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw new Error(`Failed to initialize database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Returns the active Knex instance.
   * @returns {Knex} The configured Knex instance.
   * @throws {Error} if the adapter has not been initialized.
   */
  public static getAdapter(): Knex {
    if (!this.isInitialized || !this.adapter) {
      throw new Error('Database adapter has not been initialized. Please call initialize() first.');
    }
    return this.adapter;
  }

  /**
   * Checks if the database connection is healthy.
   * @returns {Promise<boolean>} True if the connection is healthy, false otherwise.
   */
  public static async checkHealth(): Promise<boolean> {
    try {
      if (!this.adapter) {
        return false;
      }

      await this.adapter.raw('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Closes the database connection.
   * This should be called when the application is shutting down.
   */
  public static async close(): Promise<void> {
    if (this.adapter) {
      console.log('Closing database connection...');
      await this.adapter.destroy();
      this.adapter = null as any;
      this.isInitialized = false;
      console.log('✅ Database connection closed.');
    }
  }

  /**
   * Gets the current environment configuration.
   * @returns {string} The current environment name.
   */
  public static getCurrentEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Gets the database type from the current configuration.
   * @returns {string} The database client type (sqlite3, pg, etc.).
   */
  public static getDatabaseType(): string {
    const environment = this.getCurrentEnvironment();
    const configOptions = knexConfig[environment];
    return configOptions?.client || 'unknown';
  }

  /**
   * Gets information about the current database connection.
   * @returns Object with connection information.
   */
  public static getConnectionInfo(): {
    environment: string;
    databaseType: string;
    isInitialized: boolean;
    hasConnection: boolean;
  } {
    return {
      environment: this.getCurrentEnvironment(),
      databaseType: this.getDatabaseType(),
      isInitialized: this.isInitialized,
      hasConnection: !!this.adapter
    };
  }
}

// Backward compatibility interface for existing code
export interface DatabaseAdapter {
  all<T = any>(sql: string, params?: any): Promise<T[]>;
  get<T = any>(sql: string, params?: any): Promise<T | undefined>;
  run(sql: string, params?: any): Promise<any>;
}

// Backward compatibility adapter that wraps Knex
class KnexCompatibilityAdapter implements DatabaseAdapter {
  async all<T = any>(sql: string, params?: any): Promise<T[]> {
    const knex = DatabaseAdapterFactory.getAdapter();
    const result = await knex.raw(sql, params);

    // Handle different database result formats
    if (DatabaseAdapterFactory.getDatabaseType() === 'pg') {
      return result.rows;
    } else {
      return result;
    }
  }

  async get<T = any>(sql: string, params?: any): Promise<T | undefined> {
    const results = await this.all<T>(sql, params);
    return results[0];
  }

  async run(sql: string, params?: any): Promise<any> {
    const knex = DatabaseAdapterFactory.getAdapter();
    return await knex.raw(sql, params);
  }
}

// Unified database utilities that work with both SQLite and PostgreSQL
export const unifiedDbUtils = {
  // Execute a query and return all results
  all: async <T = any>(sql: string, params?: any): Promise<T[]> => {
    const adapter = new KnexCompatibilityAdapter();
    return await adapter.all<T>(sql, params);
  },

  // Execute a query and return first result
  get: async <T = any>(sql: string, params?: any): Promise<T | undefined> => {
    const adapter = new KnexCompatibilityAdapter();
    return await adapter.get<T>(sql, params);
  },

  // Execute a query and return info about changes
  run: async (sql: string, params?: any): Promise<any> => {
    const adapter = new KnexCompatibilityAdapter();
    return await adapter.run(sql, params);
  },

  // Execute multiple queries in a transaction
  transaction: async <T>(fn: (knex: Knex) => Promise<T>): Promise<T> => {
    const knex = DatabaseAdapterFactory.getAdapter();
    return await knex.transaction(fn);
  },

  // Get database type
  getDatabaseType: (): string => {
    return DatabaseAdapterFactory.getDatabaseType();
  },

  // Check if database is PostgreSQL
  isPostgreSQL: (): boolean => {
    return DatabaseAdapterFactory.getDatabaseType() === 'pg';
  },

  // Check if database is SQLite
  isSQLite: (): boolean => {
    return DatabaseAdapterFactory.getDatabaseType() === 'sqlite3';
  }
};

// Export the adapter factory and utilities
export { DatabaseAdapterFactory, unifiedDbUtils as dbUtils };
export type { Knex };
