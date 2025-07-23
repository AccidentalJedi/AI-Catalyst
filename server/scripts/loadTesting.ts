#!/usr/bin/env ts-node
/**
 * AI Catalyst Load Testing Script
 * Comprehensive load testing for PostgreSQL performance validation
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { dbLogger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface LoadTestConfig {
  concurrentUsers: number;
  testDurationMs: number;
  rampUpTimeMs: number;
  queryTypes: string[];
  targetResponseTimeMs: number;
}

interface LoadTestResult {
  success: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
  concurrentUsers: number;
  testDuration: number;
}

class LoadTestRunner {
  private pool: Pool;
  private config: LoadTestConfig;
  private results: number[] = [];
  private errors: string[] = [];
  private startTime: number = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
    
    // Initialize PostgreSQL connection pool with higher limits for load testing
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'ai_catalyst_dev',
      user: process.env.POSTGRES_USER || 'ai_catalyst_user',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      min: Math.min(config.concurrentUsers, 10),
      max: Math.max(config.concurrentUsers * 2, 50),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  /**
   * Execute a single database query and measure response time
   */
  private async executeQuery(queryType: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      const client = await this.pool.connect();
      
      try {
        switch (queryType) {
          case 'simple_select':
            await client.query('SELECT 1 as test');
            break;
            
          case 'user_lookup':
            await client.query('SELECT * FROM users WHERE "isActive" = true LIMIT 10');
            break;
            
          case 'grant_search':
            await client.query(`
              SELECT * FROM grant_opportunities 
              WHERE "isActive" = true AND "minDisabilityRating" <= 70 
              ORDER BY "maxGrantAmount" DESC LIMIT 20
            `);
            break;
            
          case 'complex_join':
            await client.query(`
              SELECT u.*, vv."vaDisabilityRating", COUNT(gm.id) as match_count
              FROM users u
              LEFT JOIN veteran_verification vv ON u.id = vv."userId"
              LEFT JOIN grant_matches gm ON u.id = gm."userId"
              WHERE u."isActive" = true
              GROUP BY u.id, vv."vaDisabilityRating"
              LIMIT 50
            `);
            break;
            
          case 'grant_matching':
            await client.query(`
              SELECT gm.*, go."grantName", go."maxGrantAmount"
              FROM grant_matches gm
              JOIN grant_opportunities go ON gm."grantId" = go.id
              WHERE gm."eligibilityStatus" = 'eligible'
              ORDER BY gm."frictionAdjustedScore" DESC
              LIMIT 25
            `);
            break;
            
          case 'audit_logs':
            await client.query(`
              SELECT * FROM audit_logs 
              WHERE timestamp > NOW() - INTERVAL '24 hours'
              ORDER BY timestamp DESC 
              LIMIT 100
            `);
            break;
            
          default:
            await client.query('SELECT COUNT(*) FROM users');
        }
      } finally {
        client.release();
      }
      
      const responseTime = Date.now() - startTime;
      this.results.push(responseTime);
      return responseTime;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.errors.push(`${queryType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return responseTime;
    }
  }

  /**
   * Simulate a single user session
   */
  private async simulateUser(userId: number): Promise<void> {
    const sessionDuration = this.config.testDurationMs;
    const sessionStart = Date.now();
    
    while (Date.now() - sessionStart < sessionDuration) {
      // Random query type
      const queryType = this.config.queryTypes[Math.floor(Math.random() * this.config.queryTypes.length)];
      
      await this.executeQuery(queryType);
      
      // Random delay between queries (100-500ms)
      const delay = Math.random() * 400 + 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Run load test with specified configuration
   */
  async runLoadTest(): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test with ${this.config.concurrentUsers} concurrent users`);
    console.log(`📊 Test duration: ${this.config.testDurationMs / 1000}s`);
    console.log(`⏱️  Target response time: ${this.config.targetResponseTimeMs}ms`);
    
    this.startTime = Date.now();
    this.results = [];
    this.errors = [];

    // Test database connection first
    await this.testConnection();

    // Create user simulation promises with ramp-up
    const userPromises: Promise<void>[] = [];
    const rampUpDelay = this.config.rampUpTimeMs / this.config.concurrentUsers;

    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const promise = new Promise<void>(async (resolve) => {
        // Ramp up delay
        await new Promise(r => setTimeout(r, i * rampUpDelay));
        await this.simulateUser(i);
        resolve();
      });
      
      userPromises.push(promise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    const totalDuration = Date.now() - this.startTime;
    
    // Calculate statistics
    const result = this.calculateResults(totalDuration);
    
    console.log(`✅ Load test completed in ${(totalDuration / 1000).toFixed(2)}s`);
    
    return result;
  }

  /**
   * Calculate test results and statistics
   */
  private calculateResults(totalDuration: number): LoadTestResult {
    const sortedResults = this.results.sort((a, b) => a - b);
    const totalRequests = this.results.length;
    const failedRequests = this.errors.length;
    const successfulRequests = totalRequests - failedRequests;

    const sum = this.results.reduce((acc, time) => acc + time, 0);
    const averageResponseTime = totalRequests > 0 ? sum / totalRequests : 0;

    const p95Index = Math.floor(sortedResults.length * 0.95);
    const p99Index = Math.floor(sortedResults.length * 0.99);

    return {
      success: averageResponseTime <= this.config.targetResponseTimeMs && failedRequests === 0,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      p95ResponseTime: sortedResults[p95Index] || 0,
      p99ResponseTime: sortedResults[p99Index] || 0,
      maxResponseTime: sortedResults[sortedResults.length - 1] || 0,
      minResponseTime: sortedResults[0] || 0,
      requestsPerSecond: Math.round((totalRequests / (totalDuration / 1000)) * 100) / 100,
      errors: this.errors.slice(0, 10), // Limit error samples
      concurrentUsers: this.config.concurrentUsers,
      testDuration: totalDuration
    };
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Database connection successful');
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Predefined test configurations
const TEST_CONFIGS = {
  light: {
    concurrentUsers: 10,
    testDurationMs: 30000, // 30 seconds
    rampUpTimeMs: 5000,     // 5 seconds
    queryTypes: ['simple_select', 'user_lookup'],
    targetResponseTimeMs: 100
  },
  
  medium: {
    concurrentUsers: 50,
    testDurationMs: 60000,  // 1 minute
    rampUpTimeMs: 10000,    // 10 seconds
    queryTypes: ['simple_select', 'user_lookup', 'grant_search'],
    targetResponseTimeMs: 100
  },
  
  heavy: {
    concurrentUsers: 100,
    testDurationMs: 120000, // 2 minutes
    rampUpTimeMs: 20000,    // 20 seconds
    queryTypes: ['simple_select', 'user_lookup', 'grant_search', 'complex_join'],
    targetResponseTimeMs: 100
  },
  
  production: {
    concurrentUsers: 200,
    testDurationMs: 300000, // 5 minutes
    rampUpTimeMs: 30000,    // 30 seconds
    queryTypes: ['simple_select', 'user_lookup', 'grant_search', 'complex_join', 'grant_matching', 'audit_logs'],
    targetResponseTimeMs: 100
  }
};

// Main execution
async function main() {
  const testType = process.argv[2] || 'medium';
  const config = TEST_CONFIGS[testType as keyof typeof TEST_CONFIGS];
  
  if (!config) {
    console.error(`Unknown test type: ${testType}`);
    console.log('Available test types:', Object.keys(TEST_CONFIGS).join(', '));
    process.exit(1);
  }

  const runner = new LoadTestRunner(config);

  try {
    const result = await runner.runLoadTest();
    
    console.log('\n📊 Load Test Results:');
    console.log(`🎯 Success: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`👥 Concurrent Users: ${result.concurrentUsers}`);
    console.log(`📈 Total Requests: ${result.totalRequests}`);
    console.log(`✅ Successful: ${result.successfulRequests}`);
    console.log(`❌ Failed: ${result.failedRequests}`);
    console.log(`⚡ Requests/sec: ${result.requestsPerSecond}`);
    console.log(`⏱️  Avg Response Time: ${result.averageResponseTime}ms`);
    console.log(`📊 95th Percentile: ${result.p95ResponseTime}ms`);
    console.log(`📊 99th Percentile: ${result.p99ResponseTime}ms`);
    console.log(`⏱️  Min Response Time: ${result.minResponseTime}ms`);
    console.log(`⏱️  Max Response Time: ${result.maxResponseTime}ms`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Sample Errors:');
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    // Performance validation
    console.log('\n🎯 Performance Validation:');
    console.log(`Target Response Time: ${config.targetResponseTimeMs}ms`);
    console.log(`Actual Avg Response Time: ${result.averageResponseTime}ms`);
    console.log(`Target Met: ${result.averageResponseTime <= config.targetResponseTimeMs ? '✅' : '❌'}`);
    
    if (config.concurrentUsers >= 200) {
      console.log(`200+ Users Support: ${result.concurrentUsers >= 200 ? '✅' : '❌'}`);
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { LoadTestRunner, TEST_CONFIGS };
