import { dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';

// Friction scoring components as defined in the framework
export interface FrictionScoreComponents {
  documentationBurden: number; // 1-3 scale (1=minimal, 2=moderate, 3=extensive)
  processSteps: number; // 1-3 scale (1=simple, 2=moderate, 3=complex)
  thirdPartyDependency: number; // 1-3 scale (1=self-service, 2=some coordination, 3=heavy dependency)
  ambiguityGatekeeping: number; // 1-3 scale (1=clear/transparent, 2=some ambiguity, 3=opaque/gatekept)
  submissionMode: number; // 1-3 scale (1=online, 2=mixed, 3=mail/fax only)
}

// Friction score weights based on framework analysis
const FRICTION_WEIGHTS = {
  documentationBurden: 0.25,
  processSteps: 0.20,
  thirdPartyDependency: 0.25,
  ambiguityGatekeeping: 0.20,
  submissionMode: 0.10
};

// Grant application complexity categories
export enum ApplicationComplexity {
  LOW = 'low', // Friction score 1-3
  MEDIUM = 'medium', // Friction score 4-6
  HIGH = 'high' // Friction score 7-10
}

// Application mode types
export enum ApplicationMode {
  FAST_TRACK_FACILITATOR = 'fast_track_facilitator', // Low friction grants
  PROJECT_MANAGER = 'project_manager' // High friction grants
}

/**
 * Calculate overall friction score from components
 */
export const calculateFrictionScore = (components: FrictionScoreComponents): number => {
  // Validate component values are within range
  for (const [key, value] of Object.entries(components)) {
    if (value < 1 || value > 3) {
      throw new Error(`Invalid friction component value for ${key}: ${value}. Must be between 1 and 3.`);
    }
  }
  
  // Calculate weighted sum
  const weightedSum = Object.entries(components).reduce((sum, [key, value]) => {
    const weight = FRICTION_WEIGHTS[key as keyof FrictionScoreComponents];
    return sum + (value * weight);
  }, 0);
  
  // Scale to 1-10 range and round
  const frictionScore = Math.round(weightedSum * 10 / 3);
  
  // Ensure result is within bounds
  return Math.max(1, Math.min(10, frictionScore));
};

/**
 * Determine application complexity category from friction score
 */
export const getApplicationComplexity = (frictionScore: number): ApplicationComplexity => {
  if (frictionScore <= 3) return ApplicationComplexity.LOW;
  if (frictionScore <= 6) return ApplicationComplexity.MEDIUM;
  return ApplicationComplexity.HIGH;
};

/**
 * Determine recommended application mode based on friction score
 */
export const getRecommendedApplicationMode = (frictionScore: number): ApplicationMode => {
  return frictionScore <= 4 ? ApplicationMode.FAST_TRACK_FACILITATOR : ApplicationMode.PROJECT_MANAGER;
};

/**
 * Analyze documentation burden component
 */
export const analyzeDocumentationBurden = (requiredDocuments: string[]): number => {
  const documentCount = requiredDocuments.length;
  
  // Check for complex document types
  const complexDocuments = [
    'dd214', 'va_rating_decision', 'tax_returns', 'financial_statements',
    'medical_records', 'court_orders', 'business_licenses'
  ];
  
  const hasComplexDocs = requiredDocuments.some(doc => 
    complexDocuments.some(complex => doc.toLowerCase().includes(complex))
  );
  
  if (documentCount <= 2 && !hasComplexDocs) return 1; // Minimal
  if (documentCount <= 5 || hasComplexDocs) return 2; // Moderate
  return 3; // Extensive
};

/**
 * Analyze process steps component
 */
export const analyzeProcessSteps = (actionableSteps: string[]): number => {
  const stepCount = actionableSteps.length;
  
  // Check for complex step types
  const complexStepKeywords = [
    'notarize', 'certify', 'verify', 'interview', 'review', 'approval',
    'coordination', 'third-party', 'multiple submissions'
  ];
  
  const hasComplexSteps = actionableSteps.some(step =>
    complexStepKeywords.some(keyword => step.toLowerCase().includes(keyword))
  );
  
  if (stepCount <= 3 && !hasComplexSteps) return 1; // Simple
  if (stepCount <= 6 || hasComplexSteps) return 2; // Moderate
  return 3; // Complex
};

/**
 * Analyze third-party dependency component
 */
export const analyzeThirdPartyDependency = (processDescription: string): number => {
  const dependencyKeywords = {
    low: ['self-service', 'online', 'automated', 'direct'],
    medium: ['coordination', 'verification', 'approval', 'review'],
    high: ['multiple agencies', 'third-party', 'external verification', 'committee review']
  };
  
  const description = processDescription.toLowerCase();
  
  if (dependencyKeywords.high.some(keyword => description.includes(keyword))) return 3;
  if (dependencyKeywords.medium.some(keyword => description.includes(keyword))) return 2;
  return 1;
};

/**
 * Analyze ambiguity and gatekeeping component
 */
export const analyzeAmbiguityGatekeeping = (
  eligibilityCriteria: string,
  applicationProcess: string
): number => {
  const clarityKeywords = {
    clear: ['specific', 'detailed', 'clear', 'explicit', 'defined'],
    ambiguous: ['may', 'might', 'consider', 'review', 'discretion', 'case-by-case'],
    opaque: ['subject to review', 'at discretion', 'as determined', 'may vary']
  };
  
  const combinedText = (eligibilityCriteria + ' ' + applicationProcess).toLowerCase();
  
  if (clarityKeywords.opaque.some(keyword => combinedText.includes(keyword))) return 3;
  if (clarityKeywords.ambiguous.some(keyword => combinedText.includes(keyword))) return 2;
  return 1;
};

/**
 * Analyze submission mode component
 */
export const analyzeSubmissionMode = (applicationURL: string, processDescription: string): number => {
  const combinedText = (applicationURL + ' ' + processDescription).toLowerCase();
  
  // Check for online submission
  if (combinedText.includes('online') || combinedText.includes('portal') || 
      combinedText.includes('website') || applicationURL.startsWith('http')) {
    return 1; // Online
  }
  
  // Check for mixed mode
  if (combinedText.includes('mail') || combinedText.includes('fax') || 
      combinedText.includes('email')) {
    if (combinedText.includes('online') || combinedText.includes('electronic')) {
      return 2; // Mixed
    }
    return 3; // Mail/fax only
  }
  
  return 2; // Default to mixed if unclear
};

/**
 * Calculate comprehensive friction score for a grant opportunity
 */
export const calculateGrantFrictionScore = (grantData: {
  requiredDocuments: string[];
  actionableSteps: string[];
  applicationProcess: string;
  eligibilityCriteria: string;
  applicationURL: string;
}): { frictionScore: number; components: FrictionScoreComponents; complexity: ApplicationComplexity } => {
  try {
    const components: FrictionScoreComponents = {
      documentationBurden: analyzeDocumentationBurden(grantData.requiredDocuments),
      processSteps: analyzeProcessSteps(grantData.actionableSteps),
      thirdPartyDependency: analyzeThirdPartyDependency(grantData.applicationProcess),
      ambiguityGatekeeping: analyzeAmbiguityGatekeeping(
        grantData.eligibilityCriteria,
        grantData.applicationProcess
      ),
      submissionMode: analyzeSubmissionMode(grantData.applicationURL, grantData.applicationProcess)
    };
    
    const frictionScore = calculateFrictionScore(components);
    const complexity = getApplicationComplexity(frictionScore);
    
    return { frictionScore, components, complexity };
  } catch (error) {
    dbLogger.error('Failed to calculate grant friction score:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      grantData
    });
    
    // Return default moderate friction score on error
    return {
      frictionScore: 5,
      components: {
        documentationBurden: 2,
        processSteps: 2,
        thirdPartyDependency: 2,
        ambiguityGatekeeping: 2,
        submissionMode: 2
      },
      complexity: ApplicationComplexity.MEDIUM
    };
  }
};

/**
 * Update grant opportunity with calculated friction score
 */
export const updateGrantFrictionScore = async (grantId: string): Promise<void> => {
  try {
    // Get grant data
    const grant = await dbUtils.get<any>(`
      SELECT requiredDocuments, actionableSteps, applicationProcess,
             eligibilityCriteria, applicationURL
      FROM grant_opportunities
      WHERE id = ?
    `, [grantId]);
    
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    // Parse JSON fields
    const grantData = {
      requiredDocuments: grant.requiredDocuments ? JSON.parse(grant.requiredDocuments) : [],
      actionableSteps: grant.actionableSteps ? JSON.parse(grant.actionableSteps) : [],
      applicationProcess: grant.applicationProcess || '',
      eligibilityCriteria: grant.eligibilityCriteria || '',
      applicationURL: grant.applicationURL || ''
    };
    
    // Calculate friction score
    const { frictionScore, components } = calculateGrantFrictionScore(grantData);
    
    // Update grant with friction score and components
    await dbUtils.run(`
      UPDATE grant_opportunities
      SET frictionScore = ?, documentationBurden = ?, processSteps = ?,
          thirdPartyDependency = ?, ambiguityGatekeeping = ?, submissionMode = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      frictionScore,
      components.documentationBurden,
      components.processSteps,
      components.thirdPartyDependency,
      components.ambiguityGatekeeping,
      components.submissionMode,
      grantId
    ]);
    
    dbLogger.info('Grant friction score updated', {
      grantId,
      frictionScore,
      components
    });
  } catch (error) {
    dbLogger.error('Failed to update grant friction score:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      grantId
    });
    throw error;
  }
};

/**
 * Batch update friction scores for all grants
 */
export const updateAllGrantFrictionScores = async (): Promise<number> => {
  try {
    const grants = await dbUtils.all<{ id: string }>(`
      SELECT id FROM grant_opportunities WHERE isActive = 1
    `);
    
    let updatedCount = 0;
    
    for (const grant of grants) {
      try {
        await updateGrantFrictionScore(grant.id);
        updatedCount++;
      } catch (error) {
        dbLogger.error('Failed to update friction score for grant:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          grantId: grant.id
        });
      }
    }
    
    dbLogger.info('Batch friction score update completed', {
      totalGrants: grants.length,
      updatedCount
    });
    
    return updatedCount;
  } catch (error) {
    dbLogger.error('Failed to batch update friction scores:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
};

/**
 * Get grants by friction score range
 */
export const getGrantsByFrictionRange = async (
  minScore: number = 1,
  maxScore: number = 10,
  limit: number = 50
): Promise<any[]> => {
  return await dbUtils.all(`
    SELECT id, grantName, grantingOrganization, frictionScore, grantType, maxGrantAmount
    FROM grant_opportunities
    WHERE isActive = 1
    AND frictionScore BETWEEN ? AND ?
    ORDER BY frictionScore ASC, maxGrantAmount DESC
    LIMIT ?
  `, [minScore, maxScore, limit]);
};

/**
 * Get friction score statistics
 */
export const getFrictionScoreStatistics = async (): Promise<{
  averageScore: number;
  distribution: Record<ApplicationComplexity, number>;
  totalGrants: number;
}> => {
  const stats = await dbUtils.get<any>(`
    SELECT
      AVG(frictionScore) as averageScore,
      COUNT(*) as totalGrants,
      SUM(CASE WHEN frictionScore <= 3 THEN 1 ELSE 0 END) as lowComplexity,
      SUM(CASE WHEN frictionScore BETWEEN 4 AND 6 THEN 1 ELSE 0 END) as mediumComplexity,
      SUM(CASE WHEN frictionScore >= 7 THEN 1 ELSE 0 END) as highComplexity
    FROM grant_opportunities
    WHERE isActive = 1
  `);
  
  return {
    averageScore: Math.round((stats?.averageScore || 0) * 100) / 100,
    distribution: {
      [ApplicationComplexity.LOW]: stats?.lowComplexity || 0,
      [ApplicationComplexity.MEDIUM]: stats?.mediumComplexity || 0,
      [ApplicationComplexity.HIGH]: stats?.highComplexity || 0
    },
    totalGrants: stats?.totalGrants || 0
  };
};


