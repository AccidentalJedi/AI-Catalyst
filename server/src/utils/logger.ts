const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Simple logging configuration to avoid circular imports
const logsDir = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the base logger
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: { service: 'ai-catalyst-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  baseLogger.add(new winston.transports.Console({
    format: developmentFormat
  }));
}

// Create specialized loggers for different components
export const createComponentLogger = (component: string) => {
  return baseLogger.child({ component });
};

// General logger export
export const logger = createComponentLogger('general');

// Specialized loggers
export const dbLogger = createComponentLogger('database');
export const apiLogger = createComponentLogger('api');
export const authLogger = createComponentLogger('auth');
export const auditLogger = createComponentLogger('audit');
export const docusignLogger = createComponentLogger('docusign');
export const boiLogger = createComponentLogger('boi-compliance');
export const emailLogger = createComponentLogger('email');
export const fileLogger = createComponentLogger('file-upload');

// Express middleware for request logging
export const requestLogger = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, meta }) => {
    return `${timestamp} [${level}] ${message} ${meta ? JSON.stringify(meta) : ''}`;
  })
);

export default logger;


