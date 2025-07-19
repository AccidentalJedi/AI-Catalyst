// Environment variables are loaded in config/index.ts
// Module aliases are handled by tsconfig-paths in development

const app = require('./app');
const config = require('@config/index');
const { dbLogger } = require('@utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  dbLogger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  dbLogger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  dbLogger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      dbLogger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    dbLogger.info('Server closed successfully');

    // TODO: Close database connections when implemented
    // database.close();

    dbLogger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    dbLogger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
const server = app.listen(config.server.port, config.server.host, () => {
  dbLogger.info(`🚀 AI Catalyst Launch Wizard Backend started`, {
    port: config.server.port,
    host: config.server.host,
    environment: config.app.environment,
    version: config.app.version,
    nodeVersion: process.version,
    pid: process.pid
  });

  dbLogger.info('📋 Server Configuration:', {
    cors: config.server.cors,
    rateLimit: config.server.rateLimit,
    database: config.database.filename,
    uploadDir: config.upload.uploadDir,
    logLevel: config.logging.level
  });

  // Log important security reminders
  if (config.app.environment === 'development') {
    dbLogger.warn('🔧 Development mode - ensure environment variables are set for production');
  }

  if (config.app.environment === 'production') {
    dbLogger.info('🔒 Production mode - security features enabled');
  }

  // Log FinCEN BOI compliance reminder
  dbLogger.info('⚖️  FinCEN BOI Compliance Reminder:', {
    deadline: config.boi.filingDeadline.toISOString(),
    daysRemaining: Math.ceil((config.boi.filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  });
});

// Handle server errors
server.on('error', (error: Error) => {
  dbLogger.error('Server error:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

export default server;


