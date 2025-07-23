/**
 * @file Jest Test Setup
 * Global test configuration and mocks for AI Catalyst Backend testing
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DOCUSIGN_INTEGRATION_KEY = 'test-integration-key';
process.env.DOCUSIGN_USER_ID = 'test-user-id';
process.env.DOCUSIGN_ACCOUNT_ID = 'test-account-id';
process.env.DOCUSIGN_PRIVATE_KEY = 'test-private-key';

// Database test configuration
process.env.DATABASE_TYPE = process.env.TEST_DATABASE_TYPE || 'postgresql';
process.env.DATABASE_PATH = './data/test-ai-catalyst.db'; // SQLite fallback
process.env.POSTGRES_HOST = process.env.TEST_POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.TEST_POSTGRES_PORT || '5432';
process.env.POSTGRES_DATABASE = process.env.TEST_POSTGRES_DATABASE || 'ai_catalyst_test';
process.env.POSTGRES_USER = process.env.TEST_POSTGRES_USER || 'ai_catalyst_test_user';
process.env.POSTGRES_PASSWORD = process.env.TEST_POSTGRES_PASSWORD || 'test_password';
process.env.POSTGRES_SSL = 'false';
process.env.POSTGRES_POOL_MIN = '1';
process.env.POSTGRES_POOL_MAX = '5';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers for consistent testing
jest.useFakeTimers();

// Global test utilities
global.testUtils = {
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-123' },
    ...overrides,
  }),

  createMockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },

  createMockNext: () => jest.fn(),

  // Mock DocuSign envelope data
  createMockForm205Data: () => ({
    documentName: 'Texas Form 205 - Certificate of Formation',
    signerEmail: 'test@example.com',
    signerName: 'Test User',
    companyName: 'Test LLC',
    registeredAgentName: 'Test Agent',
    registeredAgentAddress: '123 Main St, Austin, TX 78701',
  }),

  createMockOperatingAgreementData: () => ({
    documentName: 'LLC Operating Agreement',
    signerEmail: 'test@example.com',
    signerName: 'Test User',
    companyName: 'Test LLC',
    memberName: 'Test Member',
    membershipPercentage: '100%',
    effectiveDate: new Date().toISOString(),
  }),

  createMockEINData: () => ({
    documentName: 'IRS Form SS-4 - EIN Application',
    signerEmail: 'test@example.com',
    signerName: 'Test User',
    companyName: 'Test LLC',
    businessAddress: '123 Main St, Austin, TX 78701',
    responsiblePartyName: 'Test User',
    responsiblePartySSN: 'XXX-XX-XXXX',
  }),
};

// Global test timeout
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Cleanup after all tests
afterAll(() => {
  jest.useRealTimers();
});
