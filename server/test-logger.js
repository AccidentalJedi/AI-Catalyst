// Simple test to check logger
console.log('Testing logger import...');

try {
  require('ts-node/register');
  require('tsconfig-paths/register');
  
  console.log('About to import logger...');
  const { logger } = require('./src/utils/logger.ts');
  console.log('Logger imported successfully!');
  logger.info('Test log message');
} catch (error) {
  console.error('Error importing logger:', error.message);
  console.error('Stack:', error.stack);
}
