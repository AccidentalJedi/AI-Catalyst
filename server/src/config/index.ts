import { ServerConfig, DatabaseConfig, DocuSignConfig } from '../types/index';
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables first
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment validation - conditional based on NODE_ENV
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Critical environment variables required in all environments
const criticalEnvVars = [
  'NODE_ENV',
  'PORT'
];

// Production-only required environment variables
const productionEnvVars = [
  'JWT_SECRET',
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY'
];

// Validate critical environment variables
for (const envVar of criticalEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing critical environment variable: ${envVar}`);
  }
}

// Validate production environment variables only in production
if (isProduction) {
  for (const envVar of productionEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required production environment variable: ${envVar}`);
    }
  }
} else if (isDevelopment) {
  // Log warnings for missing development environment variables
  const missingDevVars = productionEnvVars.filter(envVar => !process.env[envVar]);
  if (missingDevVars.length > 0) {
    console.warn('⚠️  Development mode: Using fallback values for missing environment variables:', missingDevVars.join(', '));
    console.warn('⚠️  Set these variables in .env file for full functionality');
  }
}

// Development fallback values
const developmentDefaults = {
  JWT_SECRET: 'development-jwt-secret-not-for-production-use-only',
  DOCUSIGN_INTEGRATION_KEY: 'dev-integration-key',
  DOCUSIGN_USER_ID: 'dev-user-id',
  DOCUSIGN_ACCOUNT_ID: 'dev-account-id',
  DOCUSIGN_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nDEV_KEY_PLACEHOLDER\n-----END RSA PRIVATE KEY-----'
};

// Helper function to get environment variable with development fallback
const getEnvVar = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value) return value;

  if (isDevelopment && developmentDefaults[key as keyof typeof developmentDefaults]) {
    return developmentDefaults[key as keyof typeof developmentDefaults];
  }

  if (fallback) return fallback;

  throw new Error(`Missing required environment variable: ${key}`);
};

// Server Configuration
export const serverConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // limit each IP to 100 requests per windowMs
  },
  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  upload: {
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png']
  }
};

// Database Configuration
export const databaseConfig: DatabaseConfig = {
  filename: process.env.DATABASE_PATH || path.join(__dirname, '../../data/ai-catalyst.db'),
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    fileMustExist: false,
    timeout: parseInt(process.env.DB_TIMEOUT || '5000', 10)
  }
};

// DocuSign Configuration (2025 Current)
export const docusignConfig: DocuSignConfig = {
  integrationKey: getEnvVar('DOCUSIGN_INTEGRATION_KEY'),
  userId: getEnvVar('DOCUSIGN_USER_ID'),
  accountId: getEnvVar('DOCUSIGN_ACCOUNT_ID'),
  privateKey: getEnvVar('DOCUSIGN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  basePath: process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi',
  oAuthBasePath: process.env.DOCUSIGN_OAUTH_BASE_PATH || 'https://account-d.docusign.com'
};

// Email Configuration
export const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// File Upload Configuration
export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
};

// FinCEN BOI Compliance Configuration (2025 Critical)
export const boiConfig = {
  filingDeadline: new Date('2025-03-21'), // March 21, 2025 deadline
  reminderDays: [30, 14, 7, 3, 1], // Days before deadline to send reminders
  exemptionTypes: [
    'large_operating_company',
    'subsidiary',
    'inactive_entity',
    'public_company',
    'governmental_authority',
    'bank',
    'credit_union',
    'depository_institution_holding_company',
    'money_services_business',
    'broker_dealer',
    'securities_exchange_act_company',
    'investment_company',
    'investment_adviser',
    'venture_capital_fund_adviser',
    'insurance_company',
    'state_licensed_insurance_producer',
    'commodity_exchange_act_entity',
    'accounting_firm',
    'public_utility',
    'financial_market_utility',
    'pooled_investment_vehicle',
    'tax_exempt_entity'
  ]
};

// Texas SOS API Configuration
export const texasSosConfig = {
  baseUrl: process.env.TEXAS_SOS_API_URL || 'https://mycpa.cpa.state.tx.us/coa',
  timeout: parseInt(process.env.TEXAS_SOS_TIMEOUT || '10000', 10),
  retryAttempts: parseInt(process.env.TEXAS_SOS_RETRY_ATTEMPTS || '3', 10)
};

// Logging Configuration
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'combined',
  directory: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
  maxSize: process.env.LOG_MAX_SIZE || '20m'
};

// Security Configuration
export const securityConfig = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  sessionSecret: process.env.SESSION_SECRET || (isDevelopment ? 'dev-session-secret' : 'ai-catalyst-session-secret'),
  csrfSecret: process.env.CSRF_SECRET || (isDevelopment ? 'dev-csrf-secret' : 'ai-catalyst-csrf-secret'),
  encryptionKey: process.env.ENCRYPTION_KEY || (isDevelopment ? 'dev-encryption-key-32-chars-long' : 'ai-catalyst-encryption-key-32-chars'),
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
};

// Application Configuration
export const appConfig = {
  name: 'AI Catalyst Launch Wizard',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
};

// Log configuration status for development
if (isDevelopment) {
  console.log('🔧 AI Catalyst Backend - Development Configuration Loaded');
  console.log('📋 Configuration Status:');
  console.log(`   - Environment: ${process.env.NODE_ENV}`);
  console.log(`   - Port: ${serverConfig.port}`);
  console.log(`   - Database: ${databaseConfig.filename}`);
  console.log(`   - JWT Secret: ${serverConfig.jwt.secret.substring(0, 10)}...`);
  console.log(`   - DocuSign Integration: ${docusignConfig.integrationKey.substring(0, 10)}...`);
  console.log('⚠️  Using development defaults for missing environment variables');
}

// Export all configurations as CommonJS for compatibility
const configExports = {
  server: serverConfig,
  database: databaseConfig,
  docusign: docusignConfig,
  email: emailConfig,
  upload: uploadConfig,
  boi: boiConfig,
  texasSos: texasSosConfig,
  logging: loggingConfig,
  security: securityConfig,
  app: appConfig,
  // Also export individual configs for named imports
  serverConfig,
  databaseConfig,
  docusignConfig,
  emailConfig,
  uploadConfig,
  boiConfig,
  texasSosConfig,
  loggingConfig,
  securityConfig,
  appConfig
};

module.exports = configExports;

// Default export for compatibility
export default {
  server: serverConfig,
  database: databaseConfig,
  docusign: docusignConfig,
  upload: uploadConfig,
  boi: boiConfig,
  texasSos: texasSosConfig,
  logging: loggingConfig,
  security: securityConfig,
  app: appConfig
};


