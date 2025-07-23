// @ts-check

// Load environment variables from .env file
require('./server/node_modules/dotenv').config({ path: './server/.env' });

/**
 * @type { import("knex").Knex.Config }
 */
module.exports = {
  // Development configuration - supports both SQLite and PostgreSQL
  development: process.env.DATABASE_TYPE === 'postgresql' ? {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DATABASE || 'ai_catalyst_dev',
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
      max: parseInt(process.env.POSTGRES_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_POOL_IDLE_TIMEOUT || '30000', 10),
      acquireTimeoutMillis: parseInt(process.env.POSTGRES_POOL_CONNECTION_TIMEOUT || '2000', 10),
    },
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  } : {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || './server/data/ai-catalyst.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },

  // Production configuration using PostgreSQL for scalability and performance
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
      max: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10)
    },
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },

  // Test configuration - can use either SQLite or PostgreSQL
  test: {
    client: process.env.TEST_DATABASE_TYPE === 'postgresql' ? 'pg' : 'sqlite3',
    connection: process.env.TEST_DATABASE_TYPE === 'postgresql' ? {
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5432', 10),
      database: process.env.TEST_POSTGRES_DATABASE || 'ai_catalyst_test',
      user: process.env.TEST_POSTGRES_USER || 'ai_catalyst_test_user',
      password: process.env.TEST_POSTGRES_PASSWORD || 'test_password',
      ssl: false
    } : {
      filename: './server/data/test-ai-catalyst.db'
    },
    useNullAsDefault: process.env.TEST_DATABASE_TYPE !== 'postgresql',
    pool: process.env.TEST_DATABASE_TYPE === 'postgresql' ? {
      min: 1,
      max: 5
    } : undefined,
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  }
};
