#!/usr/bin/env ts-node
/**
 * AI Catalyst Knex.js System Validation Script
 * Validates that the complete Knex.js migration and seeding system works correctly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface ValidationResult {
  success: boolean;
  migrationsWorking: boolean;
  seedingWorking: boolean;
  dataIntegrity: boolean;
  issues: string[];
  recommendations: string[];
}

class KnexSystemValidator {
  private projectRoot: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
  }

  async validateSystem(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: false,
      migrationsWorking: false,
      seedingWorking: false,
      dataIntegrity: false,
      issues: [],
      recommendations: []
    };

    console.log('🔍 AI Catalyst Knex.js System Validation');
    console.log('=========================================\n');

    try {
      // Step 1: Validate knexfile.js exists and is valid
      await this.validateKnexfile(result);
      
      // Step 2: Test migrations
      await this.validateMigrations(result);
      
      // Step 3: Test seeding
      await this.validateSeeding(result);
      
      // Step 4: Validate data integrity
      await this.validateDataIntegrity(result);
      
      // Final assessment
      result.success = result.migrationsWorking && result.seedingWorking && result.dataIntegrity;
      
    } catch (error) {
      result.issues.push(`System validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async validateKnexfile(result: ValidationResult): void {
    console.log('📋 Validating knexfile.js...');
    
    try {
      const knexfilePath = path.join(this.projectRoot, 'knexfile.js');
      const knexfile = require(knexfilePath);
      
      // Check required environments
      const requiredEnvs = ['development', 'production', 'test'];
      const missingEnvs = requiredEnvs.filter(env => !knexfile[env]);
      
      if (missingEnvs.length > 0) {
        result.issues.push(`Missing environments in knexfile.js: ${missingEnvs.join(', ')}`);
      } else {
        console.log('   ✅ All required environments configured');
      }
      
      // Check migration directories
      for (const env of requiredEnvs) {
        if (knexfile[env] && knexfile[env].migrations && knexfile[env].migrations.directory) {
          console.log(`   ✅ ${env} migration directory: ${knexfile[env].migrations.directory}`);
        } else {
          result.issues.push(`Missing migration directory for ${env} environment`);
        }
      }
      
    } catch (error) {
      result.issues.push(`Failed to load knexfile.js: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateMigrations(result: ValidationResult): void {
    console.log('\n🔄 Testing database migrations...');
    
    try {
      // Change to server directory for npm commands
      const serverDir = path.join(this.projectRoot, 'server');
      
      // Test migration rollback (to clean state)
      console.log('   Rolling back migrations...');
      try {
        await execAsync('npm run db:migrate:down', { cwd: serverDir });
      } catch (error) {
        // Ignore errors if no migrations to rollback
      }
      
      // Test migration up
      console.log('   Running migrations...');
      const { stdout: migrateOutput } = await execAsync('npm run db:migrate:latest', { cwd: serverDir });
      
      if (migrateOutput.includes('Already up to date') || migrateOutput.includes('Batch')) {
        console.log('   ✅ Migrations executed successfully');
        result.migrationsWorking = true;
      } else {
        result.issues.push('Migration output indicates potential issues');
      }
      
    } catch (error) {
      result.issues.push(`Migration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.recommendations.push('Check database connection and migration files');
    }
  }

  private async validateSeeding(result: ValidationResult): void {
    console.log('\n🌱 Testing database seeding...');
    
    try {
      const serverDir = path.join(this.projectRoot, 'server');
      
      // Test seeding
      console.log('   Running seeds...');
      const { stdout: seedOutput } = await execAsync('npm run db:seed', { cwd: serverDir });
      
      if (seedOutput.includes('Ran') || seedOutput.includes('seed')) {
        console.log('   ✅ Seeds executed successfully');
        result.seedingWorking = true;
      } else {
        result.issues.push('Seed output indicates potential issues');
      }
      
    } catch (error) {
      result.issues.push(`Seeding test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.recommendations.push('Check seed files and database connection');
    }
  }

  private async validateDataIntegrity(result: ValidationResult): void {
    console.log('\n🔍 Validating data integrity...');
    
    try {
      // Import database adapter to check data
      const { DatabaseAdapterFactory } = await import('../src/utils/databaseAdapter');
      
      await DatabaseAdapterFactory.initialize();
      const adapter = DatabaseAdapterFactory.getAdapter();
      
      // Check if test users were created
      const users = await adapter.all('SELECT * FROM users WHERE email LIKE \'%example.com\'');
      
      if (Array.isArray(users) && users.length >= 2) {
        console.log(`   ✅ Found ${users.length} test users`);
        
        // Check if veteran verification exists
        const veteranVerification = await adapter.all('SELECT * FROM veteran_verification');
        
        if (Array.isArray(veteranVerification) && veteranVerification.length > 0) {
          console.log(`   ✅ Found ${veteranVerification.length} veteran verification records`);
          result.dataIntegrity = true;
        } else {
          result.issues.push('No veteran verification records found');
        }
        
        // Check if grant opportunities exist
        const grants = await adapter.all('SELECT * FROM grant_opportunities');
        
        if (Array.isArray(grants) && grants.length > 0) {
          console.log(`   ✅ Found ${grants.length} grant opportunities`);
        } else {
          result.issues.push('No grant opportunities found');
        }
        
      } else {
        result.issues.push('Test users not found - seeding may have failed');
      }
      
      await DatabaseAdapterFactory.close();
      
    } catch (error) {
      result.issues.push(`Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.recommendations.push('Ensure database is accessible and seeded properly');
    }
  }
}

async function main() {
  const validator = new KnexSystemValidator();
  
  try {
    const result = await validator.validateSystem();
    
    console.log('\n📊 Knex.js System Validation Results');
    console.log('====================================');
    console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Migrations Working: ${result.migrationsWorking ? '✅' : '❌'}`);
    console.log(`Seeding Working: ${result.seedingWorking ? '✅' : '❌'}`);
    console.log(`Data Integrity: ${result.dataIntegrity ? '✅' : '❌'}`);
    
    if (result.issues.length > 0) {
      console.log('\n❌ Issues Found:');
      result.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    if (result.success) {
      console.log('\n🎉 Knex.js system is fully functional!');
      console.log('\n📋 Available Commands:');
      console.log('   npm run db:migrate:latest  - Run all pending migrations');
      console.log('   npm run db:migrate:down    - Rollback last migration');
      console.log('   npm run db:seed            - Run all seed files');
      console.log('   npm run db:fresh           - Reset and reseed database');
      console.log('   npm run db:seed:make       - Create new seed file');
    } else {
      console.log('\n❌ Knex.js system has issues that need to be resolved.');
    }
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Validation failed with error:', error);
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  main();
}

export { KnexSystemValidator };
