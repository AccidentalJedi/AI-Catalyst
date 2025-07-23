#!/usr/bin/env ts-node
/**
 * AI Catalyst Database Configuration Validation Script
 * Validates that the dual-database system is properly configured
 */

import dotenv from 'dotenv';
import { DatabaseAdapterFactory } from '../src/utils/databaseAdapter';
import { activeDatabaseConfig } from '../src/config/index';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface ValidationResult {
  success: boolean;
  databaseType: string;
  issues: string[];
  recommendations: string[];
}

class DatabaseConfigValidator {
  
  async validateConfiguration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: false,
      databaseType: activeDatabaseConfig.type,
      issues: [],
      recommendations: []
    };

    console.log('🔍 AI Catalyst Database Configuration Validation');
    console.log('================================================\n');

    // Check environment variables
    this.validateEnvironmentVariables(result);
    
    // Check database adapter
    await this.validateDatabaseAdapter(result);
    
    // Check connection
    await this.validateConnection(result);
    
    // Final assessment
    result.success = result.issues.length === 0;
    
    return result;
  }

  private validateEnvironmentVariables(result: ValidationResult): void {
    console.log('📋 Checking Environment Variables...');
    
    const databaseType = process.env.DATABASE_TYPE || 'sqlite';
    console.log(`   Database Type: ${databaseType}`);
    
    if (databaseType === 'postgresql') {
      const requiredPostgresVars = [
        'POSTGRES_HOST',
        'POSTGRES_PORT', 
        'POSTGRES_DATABASE',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD'
      ];
      
      const missingVars = requiredPostgresVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        result.issues.push(`Missing PostgreSQL environment variables: ${missingVars.join(', ')}`);
        result.recommendations.push('Set all required PostgreSQL environment variables in .env file');
      } else {
        console.log('   ✅ All PostgreSQL environment variables present');
      }
      
      // Check DATABASE_URL
      if (!process.env.DATABASE_URL) {
        result.issues.push('DATABASE_URL not set for PostgreSQL');
        result.recommendations.push('Set DATABASE_URL for PostgreSQL connection string');
      }
      
    } else if (databaseType === 'sqlite') {
      if (!process.env.DATABASE_PATH) {
        result.recommendations.push('Consider setting DATABASE_PATH for SQLite database location');
      } else {
        console.log(`   ✅ SQLite database path: ${process.env.DATABASE_PATH}`);
      }
    } else {
      result.issues.push(`Invalid DATABASE_TYPE: ${databaseType}. Must be 'sqlite' or 'postgresql'`);
    }
  }

  private async validateDatabaseAdapter(result: ValidationResult): void {
    console.log('\n🔧 Checking Database Adapter...');
    
    try {
      const adapter = DatabaseAdapterFactory.getAdapter();
      console.log(`   ✅ Database adapter created for: ${result.databaseType}`);
      
      // Check adapter methods
      const requiredMethods = ['initialize', 'close', 'checkHealth', 'all', 'get', 'run'];
      const missingMethods = requiredMethods.filter(method => typeof (adapter as any)[method] !== 'function');
      
      if (missingMethods.length > 0) {
        result.issues.push(`Database adapter missing methods: ${missingMethods.join(', ')}`);
      } else {
        console.log('   ✅ All required adapter methods present');
      }
      
    } catch (error) {
      result.issues.push(`Failed to create database adapter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateConnection(result: ValidationResult): void {
    console.log('\n🔌 Testing Database Connection...');
    
    try {
      // Initialize the adapter
      await DatabaseAdapterFactory.initialize();
      console.log('   ✅ Database adapter initialized successfully');
      
      // Test health check
      const isHealthy = await DatabaseAdapterFactory.checkHealth();
      if (isHealthy) {
        console.log('   ✅ Database health check passed');
      } else {
        result.issues.push('Database health check failed');
      }
      
      // Test basic query
      const adapter = DatabaseAdapterFactory.getAdapter();
      const testQuery = result.databaseType === 'postgresql' ? 'SELECT 1 as test' : 'SELECT 1 as test';
      
      const testResult = await adapter.get(testQuery);
      if (testResult && (testResult as any).test === 1) {
        console.log('   ✅ Basic query test passed');
      } else {
        result.issues.push('Basic query test failed');
      }
      
    } catch (error) {
      result.issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (result.databaseType === 'postgresql') {
        result.recommendations.push('Ensure PostgreSQL server is running and accessible');
        result.recommendations.push('Verify PostgreSQL credentials and database exists');
        result.recommendations.push('Check firewall and network connectivity');
      } else {
        result.recommendations.push('Ensure SQLite database directory is writable');
        result.recommendations.push('Check file permissions for SQLite database');
      }
    }
  }
}

async function main() {
  const validator = new DatabaseConfigValidator();
  
  try {
    const result = await validator.validateConfiguration();
    
    console.log('\n📊 Validation Results');
    console.log('=====================');
    console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Database Type: ${result.databaseType}`);
    
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
      console.log('\n🎉 Database configuration is valid and working!');

      // Show configuration summary
      console.log('\n📋 Configuration Summary:');
      console.log(`   Database Type: ${result.databaseType}`);
      console.log(`   Migration System: Custom SQL migrations (server/migrations/)`);

      if (result.databaseType === 'postgresql') {
        console.log(`   Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
        console.log(`   Port: ${process.env.POSTGRES_PORT || '5432'}`);
        console.log(`   Database: ${process.env.POSTGRES_DATABASE || 'ai_catalyst_dev'}`);
        console.log(`   User: ${process.env.POSTGRES_USER || 'ai_catalyst_user'}`);
        console.log(`   Pool Min: ${process.env.POSTGRES_POOL_MIN || '2'}`);
        console.log(`   Pool Max: ${process.env.POSTGRES_POOL_MAX || '20'}`);
      } else {
        console.log(`   Database Path: ${process.env.DATABASE_PATH || './server/data/ai-catalyst.db'}`);
      }
    } else {
      console.log('\n❌ Database configuration has issues that need to be resolved.');
    }
    
    // Close database connection
    await DatabaseAdapterFactory.close();
    
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

export { DatabaseConfigValidator };
