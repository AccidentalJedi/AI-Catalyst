/**
 * Jest Configuration for AI Catalyst Backend
 * 
 * Configured for TypeScript testing with path aliases and comprehensive coverage reporting.
 * Follows Bridge-Service-Architecture.md testing guidelines for isolated unit testing.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // TypeScript support
  preset: 'ts-jest',

  // Root directory for tests
  rootDir: './src',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Module path mapping (matches tsconfig.json paths) - CORRECT PROPERTY NAME
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@controllers/(.*)$': '<rootDir>/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@models/(.*)$': '<rootDir>/models/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@templates/(.*)$': '<rootDir>/templates/$1'
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '../coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  // Coverage thresholds (reduced for initial testing)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'services/**/*.ts',
    'controllers/**/*.ts',
    'middleware/**/*.ts',
    'utils/**/*.ts',
    '!**/__tests__/**',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**'
  ],

  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.json'
    }]
  },

  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Verbose output for detailed test results
  verbose: true,

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,

  // Global test setup
  globalSetup: '<rootDir>/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/globalTeardown.ts',

  // Error handling
  errorOnDeprecated: true,

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/../node_modules/',
    '<rootDir>/../dist/',
    '<rootDir>/../coverage/',
    '<rootDir>/../logs/'
  ]
};
