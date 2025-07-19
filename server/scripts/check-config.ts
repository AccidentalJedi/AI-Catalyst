#!/usr/bin/env ts-node

/**
 * Configuration Check Script
 * Validates that all required environment variables and dependencies are properly configured
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

// Helper function to add check result
const addResult = (name: string, status: 'pass' | 'fail' | 'warn', message: string) => {
  results.push({ name, status, message });
};

// Check required environment variables
const checkEnvironmentVariables = () => {
  console.log('🔍 Checking environment variables...\n');

  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'DOCUSIGN_INTEGRATION_KEY',
    'DOCUSIGN_USER_ID',
    'DOCUSIGN_ACCOUNT_ID',
    'DOCUSIGN_PRIVATE_KEY'
  ];

  const optionalVars = [
    'DATABASE_PATH',
    'CORS_ORIGINS',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'LOG_LEVEL'
  ];

  // Check required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      addResult(`ENV: ${varName}`, 'pass', 'Set');
    } else {
      addResult(`ENV: ${varName}`, 'fail', 'Missing required environment variable');
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      addResult(`ENV: ${varName}`, 'pass', 'Set');
    } else {
      addResult(`ENV: ${varName}`, 'warn', 'Optional variable not set (using default)');
    }
  }

  // Validate JWT secret strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      addResult('JWT Secret Strength', 'warn', 'JWT secret should be at least 32 characters long');
    } else {
      addResult('JWT Secret Strength', 'pass', 'JWT secret is sufficiently long');
    }
  }

  // Validate DocuSign private key format
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
  if (privateKey) {
    if (privateKey.includes('BEGIN RSA PRIVATE KEY') || privateKey.includes('BEGIN PRIVATE KEY')) {
      addResult('DocuSign Private Key', 'pass', 'Private key format appears valid');
    } else {
      addResult('DocuSign Private Key', 'fail', 'Private key format appears invalid');
    }
  }
};

// Check file system permissions and directories
const checkFileSystem = () => {
  console.log('📁 Checking file system...\n');

  const directories = [
    { path: path.join(__dirname, '../data'), name: 'Database directory' },
    { path: path.join(__dirname, '../logs'), name: 'Logs directory' },
    { path: path.join(__dirname, '../uploads'), name: 'Uploads directory' }
  ];

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir.path)) {
        fs.mkdirSync(dir.path, { recursive: true });
        addResult(dir.name, 'pass', 'Created successfully');
      } else {
        addResult(dir.name, 'pass', 'Exists');
      }

      // Check write permissions
      const testFile = path.join(dir.path, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      addResult(`${dir.name} (write)`, 'pass', 'Writable');
    } catch (error) {
      addResult(dir.name, 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

// Check Node.js version
const checkNodeVersion = () => {
  console.log('🟢 Checking Node.js version...\n');

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion >= 18) {
    addResult('Node.js Version', 'pass', `${nodeVersion} (supported)`);
  } else if (majorVersion >= 16) {
    addResult('Node.js Version', 'warn', `${nodeVersion} (works but Node.js 18+ recommended)`);
  } else {
    addResult('Node.js Version', 'fail', `${nodeVersion} (Node.js 18+ required)`);
  }
};

// Check package dependencies
const checkDependencies = () => {
  console.log('📦 Checking dependencies...\n');

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const criticalDeps = [
      'express',
      'better-sqlite3',
      'jsonwebtoken',
      'helmet',
      'cors',
      'winston',
      'joi',
      'docusign-esign'
    ];

    for (const dep of criticalDeps) {
      if (packageJson.dependencies[dep]) {
        addResult(`Dependency: ${dep}`, 'pass', `Version ${packageJson.dependencies[dep]}`);
      } else {
        addResult(`Dependency: ${dep}`, 'fail', 'Missing critical dependency');
      }
    }
  } catch (error) {
    addResult('Package.json', 'fail', 'Could not read package.json');
  }
};

// Check TypeScript configuration
const checkTypeScript = () => {
  console.log('🔧 Checking TypeScript configuration...\n');

  const tsconfigPath = path.join(__dirname, '../tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    addResult('TypeScript Config', 'pass', 'tsconfig.json exists');
    
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      if (tsconfig.compilerOptions?.strict) {
        addResult('TypeScript Strict Mode', 'pass', 'Enabled');
      } else {
        addResult('TypeScript Strict Mode', 'warn', 'Not enabled (recommended)');
      }
    } catch (error) {
      addResult('TypeScript Config', 'fail', 'Invalid tsconfig.json');
    }
  } else {
    addResult('TypeScript Config', 'fail', 'tsconfig.json not found');
  }
};

// Print results
const printResults = () => {
  console.log('\n📋 Configuration Check Results\n');
  console.log('='.repeat(60));

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name.padEnd(30)} ${result.message}`);

    if (result.status === 'pass') passCount++;
    else if (result.status === 'warn') warnCount++;
    else failCount++;
  }

  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passCount} | ⚠️  Warnings: ${warnCount} | ❌ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n❌ Configuration has critical issues that must be resolved before starting the server.');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\n⚠️  Configuration has warnings but should work. Consider addressing warnings for optimal performance.');
  } else {
    console.log('\n🎉 Configuration looks good! You can start the server.');
  }
};

// Main execution
const main = () => {
  console.log('🚀 AI Catalyst Backend Configuration Check\n');
  
  checkNodeVersion();
  checkEnvironmentVariables();
  checkFileSystem();
  checkDependencies();
  checkTypeScript();
  
  printResults();
};

// Run the check
main();
