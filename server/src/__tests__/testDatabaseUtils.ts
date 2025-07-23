/**
 * @file Test Database Utilities
 * Utilities for managing test database state and creating test data
 */

import crypto from 'crypto';
import { dbUtils, DatabaseAdapterFactory } from '../utils/databaseAdapter';
import { hashPassword } from '../utils/encryption';

export class TestDatabaseUtils {
  
  /**
   * Clear all data from test database
   */
  static async clearDatabase(): Promise<void> {
    const databaseType = DatabaseAdapterFactory.getDatabaseType();
    
    if (databaseType === 'postgresql') {
      // PostgreSQL: Truncate all tables with CASCADE to handle foreign keys
      const tables = [
        'analytics_events', 'sync_records', 'document_cross_references',
        'document_data_points', 'document_analysis_results', 'uploaded_documents',
        'grant_matches', 'grant_opportunities', 'audit_logs', 'compliance_checkpoints',
        'generated_documents', 'business_formation_workflows', 'wizard_progress',
        'documents', 'document_templates', 'identification_documents',
        'beneficial_owners', 'boi_compliance', 'registered_agents', 'companies',
        'addresses', 'notification_preferences', 'veteran_verification',
        'user_roles', 'user_sessions', 'users', 'encryption_keys'
      ];

      for (const table of tables) {
        try {
          await dbUtils.run(`TRUNCATE TABLE "${table}" CASCADE`);
        } catch (error) {
          // Table might not exist or might be empty
          console.warn(`Warning: Could not truncate table ${table}:`, error);
        }
      }
    } else {
      // SQLite: Delete from all tables
      const tables = await dbUtils.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      for (const table of tables as any[]) {
        await dbUtils.run(`DELETE FROM "${table.name}"`);
      }
    }
  }

  /**
   * Create a test user
   */
  static async createTestUser(overrides: any = {}): Promise<any> {
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword('testpassword123');
    
    const userData = {
      id: userId,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-0123',
      passwordHash: hashedPassword,
      isActive: true,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    await dbUtils.run(`
      INSERT INTO users (
        id, email, "firstName", "lastName", phone, "passwordHash",
        "isActive", "emailVerified", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      userData.id, userData.email, userData.firstName, userData.lastName,
      userData.phone, userData.passwordHash, userData.isActive,
      userData.emailVerified, userData.createdAt, userData.updatedAt
    ]);

    return userData;
  }

  /**
   * Create a test veteran user with verification
   */
  static async createTestVeteran(overrides: any = {}): Promise<any> {
    const user = await this.createTestUser({
      email: 'veteran@example.com',
      firstName: 'John',
      lastName: 'Veteran',
      ...overrides
    });

    // Add veteran role
    const roleId = crypto.randomUUID();
    await dbUtils.run(`
      INSERT INTO user_roles (id, "userId", role, "assignedAt", "isActive")
      VALUES ($1, $2, 'veteran', CURRENT_TIMESTAMP, true)
    `, [roleId, user.id]);

    // Add veteran verification
    const verificationId = crypto.randomUUID();
    await dbUtils.run(`
      INSERT INTO veteran_verification (
        id, "userId", "verificationStatus", county, "vaDisabilityRating",
        "branchOfService", "dischargeType", "serviceEra", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'verified', 'Travis', 70, 'army', 'honorable', 'post_911', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [verificationId, user.id]);

    return user;
  }

  /**
   * Create a test company
   */
  static async createTestCompany(userId: string, overrides: any = {}): Promise<any> {
    const companyId = crypto.randomUUID();
    const addressId = crypto.randomUUID();

    // Create business address
    await dbUtils.run(`
      INSERT INTO addresses (
        id, street, city, state, "zipCode", county, type, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [addressId, '123 Main St', 'Austin', 'TX', '78701', 'Travis', 'business']);

    const companyData = {
      id: companyId,
      userId,
      legalName: 'Test LLC',
      businessType: 'LLC',
      formationState: 'TX',
      businessAddressId: addressId,
      status: 'forming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    await dbUtils.run(`
      INSERT INTO companies (
        id, "userId", "legalName", "businessType", "formationState",
        "businessAddressId", status, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      companyData.id, companyData.userId, companyData.legalName,
      companyData.businessType, companyData.formationState,
      companyData.businessAddressId, companyData.status,
      companyData.createdAt, companyData.updatedAt
    ]);

    return companyData;
  }

  /**
   * Create a test grant opportunity
   */
  static async createTestGrant(overrides: any = {}): Promise<any> {
    const grantId = crypto.randomUUID();
    
    const grantData = {
      id: grantId,
      grantName: 'Test Veteran Grant',
      grantingOrganization: 'Test Foundation',
      grantType: 'financial',
      maxGrantAmount: 5000.00,
      minDisabilityRating: 30,
      frictionScore: 5,
      documentationBurden: 2,
      processSteps: 2,
      thirdPartyDependency: 1,
      ambiguityGatekeeping: 2,
      submissionMode: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    await dbUtils.run(`
      INSERT INTO grant_opportunities (
        id, "grantName", "grantingOrganization", "grantType", "maxGrantAmount",
        "minDisabilityRating", "frictionScore", "documentationBurden",
        "processSteps", "thirdPartyDependency", "ambiguityGatekeeping",
        "submissionMode", "isActive", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      grantData.id, grantData.grantName, grantData.grantingOrganization,
      grantData.grantType, grantData.maxGrantAmount, grantData.minDisabilityRating,
      grantData.frictionScore, grantData.documentationBurden, grantData.processSteps,
      grantData.thirdPartyDependency, grantData.ambiguityGatekeeping,
      grantData.submissionMode, grantData.isActive, grantData.createdAt, grantData.updatedAt
    ]);

    return grantData;
  }

  /**
   * Create a test grant match
   */
  static async createTestGrantMatch(userId: string, grantId: string, overrides: any = {}): Promise<any> {
    const matchId = crypto.randomUUID();
    
    const matchData = {
      id: matchId,
      userId,
      grantId,
      matchScore: 0.85,
      eligibilityStatus: 'eligible',
      matchReason: 'Test match',
      ruleBasedMatch: true,
      frictionAdjustedScore: 0.80,
      recommendationPriority: 1,
      lastChecked: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    await dbUtils.run(`
      INSERT INTO grant_matches (
        id, "userId", "grantId", "matchScore", "eligibilityStatus",
        "matchReason", "ruleBasedMatch", "frictionAdjustedScore",
        "recommendationPriority", "lastChecked", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      matchData.id, matchData.userId, matchData.grantId, matchData.matchScore,
      matchData.eligibilityStatus, matchData.matchReason, matchData.ruleBasedMatch,
      matchData.frictionAdjustedScore, matchData.recommendationPriority,
      matchData.lastChecked, matchData.createdAt, matchData.updatedAt
    ]);

    return matchData;
  }

  /**
   * Create a test business formation workflow
   */
  static async createTestWorkflow(userId: string, overrides: any = {}): Promise<any> {
    const workflowId = crypto.randomUUID();
    
    const workflowData = {
      id: workflowId,
      userId,
      workflowType: 'llc_formation',
      currentStep: 'business_info',
      completedSteps: JSON.stringify(['user_info']),
      status: 'in_progress',
      formData: JSON.stringify({ companyName: 'Test LLC' }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    await dbUtils.run(`
      INSERT INTO business_formation_workflows (
        id, "userId", "workflowType", "currentStep", "completedSteps",
        status, "formData", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      workflowData.id, workflowData.userId, workflowData.workflowType,
      workflowData.currentStep, workflowData.completedSteps, workflowData.status,
      workflowData.formData, workflowData.createdAt, workflowData.updatedAt
    ]);

    return workflowData;
  }

  /**
   * Get test database statistics
   */
  static async getDatabaseStats(): Promise<any> {
    const stats: any = {};
    
    const tables = [
      'users', 'companies', 'grant_opportunities', 'grant_matches',
      'business_formation_workflows', 'veteran_verification'
    ];

    for (const table of tables) {
      try {
        const result = await dbUtils.get(`SELECT COUNT(*) as count FROM "${table}"`);
        stats[table] = result?.count || 0;
      } catch (error) {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Wait for database operations to complete
   */
  static async waitForDatabase(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await dbUtils.get('SELECT 1 as test');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    throw new Error('Database not ready within timeout');
  }
}

// Export convenience functions
export const {
  clearDatabase,
  createTestUser,
  createTestVeteran,
  createTestCompany,
  createTestGrant,
  createTestGrantMatch,
  createTestWorkflow,
  getDatabaseStats,
  waitForDatabase
} = TestDatabaseUtils;
