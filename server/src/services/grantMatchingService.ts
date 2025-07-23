import crypto from 'crypto';
import { dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';
import { calculateFrictionScore, getApplicationComplexity, getRecommendedApplicationMode } from './frictionScoringService';
import { VeteranProfile } from '../types/index';

// Grant matching interfaces

export interface GrantMatch {
  grantId: string;
  grantName: string;
  grantingOrganization: string;
  matchScore: number;
  eligibilityStatus: 'eligible' | 'ineligible' | 'maybe' | 'needs_review';
  matchReason: string;
  ruleBasedMatch: boolean;
  llmClassification?: string;
  llmConfidence?: number;
  frictionAdjustedScore: number;
  recommendationPriority: number;
  applicationMode: 'fast_track_facilitator' | 'project_manager';
  actionableSteps: string[];
  requiredDocuments: string[];
  estimatedCompletionTime: string;
}

/**
 * Two-stage grant matching algorithm
 * Stage 1: Rule-based filtering for fast elimination
 * Stage 2: LLM-powered classification for complex eligibility
 */
export const findMatchingGrants = async (
  veteranProfile: VeteranProfile,
  limit: number = 20
): Promise<GrantMatch[]> => {
  try {
    dbLogger.info('Starting two-stage grant matching', {
      userId: veteranProfile.userId,
      disabilityRating: veteranProfile.disabilityRating,
      county: veteranProfile.county
    });

    // Stage 1: Rule-based filtering
    const ruleBasedMatches = await performRuleBasedFiltering(veteranProfile);
    
    dbLogger.info('Rule-based filtering completed', {
      userId: veteranProfile.userId,
      candidateGrants: ruleBasedMatches.length
    });

    // Stage 2: LLM classification for complex eligibility
    const finalMatches = await performLLMClassification(veteranProfile, ruleBasedMatches);
    
    // Calculate friction-adjusted scores and prioritize
    const prioritizedMatches = await prioritizeMatches(finalMatches, veteranProfile);
    
    // Limit results and return
    return prioritizedMatches.slice(0, limit);
    
  } catch (error) {
    dbLogger.error('Grant matching failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: veteranProfile.userId
    });
    return [];
  }
};

/**
 * Stage 1: Rule-based filtering using SQL queries
 * Fast elimination of obviously ineligible grants
 */
const performRuleBasedFiltering = async (profile: VeteranProfile): Promise<any[]> => {
  try {
    // Build dynamic WHERE clause based on profile
    const conditions: string[] = [];
    const params: any[] = [];

    // Basic eligibility filters
    conditions.push('"isActive" = true');

    // Disability rating requirement
    conditions.push('("minDisabilityRating" IS NULL OR "minDisabilityRating" <= $' + (params.length + 1) + ')');
    params.push(profile.disabilityRating);

    // Geographic eligibility (PostgreSQL JSON syntax)
    conditions.push(`(
      "residencyRequired" IS NULL OR
      "residencyRequired"::text LIKE '%"${profile.state}"%' OR
      "residencyRequired"::text LIKE '%"${profile.county}"%'
    )`);
    
    // Service era requirements
    if (profile.serviceEra) {
      conditions.push(`(
        serviceEraRequired IS NULL OR 
        JSON_EXTRACT(serviceEraRequired, '$') LIKE '%"${profile.serviceEra}"%'
      )`);
    }
    
    // Target population (veteran, spouse, dependent)
    conditions.push(`(
      targetPopulation IS NULL OR 
      JSON_EXTRACT(targetPopulation, '$') LIKE '%"veteran"%'
    )`);

    const query = `
      SELECT
        id, "grantName", "grantingOrganization", "grantType", "maxGrantAmount",
        "eligibilityCriteria", "otherCriteriaText", "applicationProcess",
        "requiredDocuments", "actionableSteps", "frictionScore",
        "documentationBurden", "processSteps", "thirdPartyDependency",
        "ambiguityGatekeeping", "submissionMode", "pointOfContact"
      FROM grant_opportunities
      WHERE ${conditions.join(' AND ')}
      ORDER BY "maxGrantAmount" DESC, "frictionScore" ASC
    `;

    const grants = await dbUtils.all(query, params);
    
    dbLogger.info('Rule-based filtering results', {
      totalGrants: grants.length,
      conditions: conditions.length
    });

    return grants;
    
  } catch (error) {
    dbLogger.error('Rule-based filtering failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profile.userId
    });
    return [];
  }
};

/**
 * Stage 2: LLM-powered classification for complex eligibility
 * Handles nuanced criteria that can't be captured by simple rules
 */
const performLLMClassification = async (
  profile: VeteranProfile,
  candidateGrants: any[]
): Promise<GrantMatch[]> => {
  const matches: GrantMatch[] = [];
  
  for (const grant of candidateGrants) {
    try {
      // For grants with complex criteria, use LLM classification
      let eligibilityStatus: 'eligible' | 'ineligible' | 'maybe' | 'needs_review' = 'eligible';
      let llmClassification: string | undefined;
      let llmConfidence: number | undefined;
      let matchReason = 'Meets basic eligibility criteria';
      
      // Check if grant has complex criteria requiring LLM analysis
      if (grant.otherCriteriaText && grant.otherCriteriaText.trim().length > 0) {
        const llmResult = await classifyEligibilityWithLLM(profile, grant);
        eligibilityStatus = llmResult.classification;
        llmClassification = llmResult.classification;
        llmConfidence = llmResult.confidence;
        matchReason = llmResult.reason;
      }
      
      // Skip ineligible grants
      if (eligibilityStatus === 'ineligible') {
        continue;
      }
      
      // Calculate base match score
      const baseMatchScore = calculateBaseMatchScore(profile, grant);
      
      // Determine application mode based on friction score
      const applicationMode = getRecommendedApplicationMode(grant.frictionScore);
      
      // Parse required documents and actionable steps
      const requiredDocuments = grant.requiredDocuments ? 
        JSON.parse(grant.requiredDocuments) : [];
      const actionableSteps = grant.actionableSteps ? 
        JSON.parse(grant.actionableSteps) : [];
      
      const match: GrantMatch = {
        grantId: grant.id,
        grantName: grant.grantName,
        grantingOrganization: grant.grantingOrganization,
        matchScore: baseMatchScore,
        eligibilityStatus,
        matchReason,
        ruleBasedMatch: !grant.otherCriteriaText,
        llmClassification,
        llmConfidence,
        frictionAdjustedScore: 0, // Will be calculated in prioritization
        recommendationPriority: 0, // Will be calculated in prioritization
        applicationMode,
        actionableSteps,
        requiredDocuments,
        estimatedCompletionTime: estimateCompletionTime(grant.frictionScore, applicationMode)
      };
      
      matches.push(match);
      
    } catch (error) {
      dbLogger.error('LLM classification failed for grant:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        grantId: grant.id,
        userId: profile.userId
      });
      
      // Continue with rule-based match on LLM failure
      const match: GrantMatch = {
        grantId: grant.id,
        grantName: grant.grantName,
        grantingOrganization: grant.grantingOrganization,
        matchScore: calculateBaseMatchScore(profile, grant),
        eligibilityStatus: 'needs_review',
        matchReason: 'Complex criteria require manual review',
        ruleBasedMatch: true,
        frictionAdjustedScore: 0,
        recommendationPriority: 0,
        applicationMode: getRecommendedApplicationMode(grant.frictionScore),
        actionableSteps: grant.actionableSteps ? JSON.parse(grant.actionableSteps) : [],
        requiredDocuments: grant.requiredDocuments ? JSON.parse(grant.requiredDocuments) : [],
        estimatedCompletionTime: estimateCompletionTime(grant.frictionScore, getRecommendedApplicationMode(grant.frictionScore))
      };
      
      matches.push(match);
    }
  }
  
  return matches;
};

/**
 * Calculate base match score based on profile alignment
 */
const calculateBaseMatchScore = (profile: VeteranProfile, grant: any): number => {
  let score = 0.5; // Base score
  
  // Disability rating alignment
  if (grant.minDisabilityRating && profile.disabilityRating >= grant.minDisabilityRating) {
    score += 0.2;
  }
  
  // Geographic alignment
  if (grant.residencyRequired) {
    const residencyReqs = JSON.parse(grant.residencyRequired);
    if (residencyReqs.includes(profile.state) || residencyReqs.includes(profile.county)) {
      score += 0.15;
    }
  }
  
  // Needs alignment
  if (grant.grantType && profile.needs.length > 0) {
    const grantType = grant.grantType.toLowerCase();
    const hasMatchingNeed = profile.needs.some(need => 
      grantType.includes(need.toLowerCase()) || need.toLowerCase().includes(grantType)
    );
    if (hasMatchingNeed) {
      score += 0.15;
    }
  }
  
  return Math.min(1.0, score);
};

/**
 * Estimate completion time based on friction score and application mode
 */
const estimateCompletionTime = (frictionScore: number, applicationMode: string): string => {
  if (applicationMode === 'fast_track_facilitator') {
    return frictionScore <= 2 ? '1-2 hours' : '2-4 hours';
  } else {
    if (frictionScore <= 6) return '1-2 weeks';
    if (frictionScore <= 8) return '2-4 weeks';
    return '1-2 months';
  }
};

/**
 * LLM-powered eligibility classification for complex criteria
 * Integrated with Ollama, LMStudio, and OpenRouter
 */
const classifyEligibilityWithLLM = async (
  profile: VeteranProfile,
  grant: any
): Promise<{ classification: 'eligible' | 'ineligible' | 'maybe'; confidence: number; reason: string }> => {
  try {
    // Import and use the LLM classification service
    const { LLMClassificationService } = await import('./llmClassificationService');
    const llmService = LLMClassificationService.getInstance();

    // Prepare classification request
    const classificationRequest = {
      veteranProfile: {
        disabilityRating: profile.disabilityRating,
        isPermanentAndTotal: profile.isPermanentAndTotal,
        state: profile.state,
        county: profile.county,
        maritalStatus: profile.maritalStatus,
        hasMinorChildren: profile.hasMinorChildren,
        annualHouseholdIncome: profile.annualHouseholdIncome,
        isHomelessOrAtRisk: profile.isHomelessOrAtRisk,
        serviceEra: profile.serviceEra,
        branchOfService: profile.branchOfService,
        dischargeType: profile.dischargeType,
        needs: profile.needs
      },
      grantCriteria: {
        grantName: grant.grantName,
        eligibilityCriteria: grant.eligibilityCriteria || '',
        otherCriteriaText: grant.otherCriteriaText || '',
        targetPopulation: grant.targetPopulation ? JSON.parse(grant.targetPopulation) : [],
        residencyRequired: grant.residencyRequired ? JSON.parse(grant.residencyRequired) : []
      }
    };

    // Perform LLM classification
    const result = await llmService.classifyEligibility(classificationRequest);

    dbLogger.info('LLM classification completed', {
      grantId: grant.id,
      userId: profile.userId,
      classification: result.classification,
      confidence: result.confidence,
      keyFactors: result.keyFactors?.length || 0
    });

    return {
      classification: result.classification,
      confidence: result.confidence,
      reason: result.reason
    };

  } catch (error) {
    dbLogger.error('LLM classification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      grantId: grant.id,
      userId: profile.userId
    });

    // Fallback to pattern-based classification
    return await performPatternBasedClassification(profile, grant);
  }
};

/**
 * Construct prompt for LLM eligibility classification
 */
const constructEligibilityPrompt = (profile: VeteranProfile, grant: any): string => {
  return `
Veteran Profile:
- Disability Rating: ${profile.disabilityRating}%
- P&T Status: ${profile.isPermanentAndTotal ? 'Yes' : 'No'}
- Location: ${profile.county}, ${profile.state}
- Marital Status: ${profile.maritalStatus}
- Minor Children: ${profile.hasMinorChildren ? 'Yes' : 'No'}
- Service Era: ${profile.serviceEra}
- Branch: ${profile.branchOfService}
- Discharge: ${profile.dischargeType}
- Income: ${profile.annualHouseholdIncome || 'Not provided'}
- Homeless/At Risk: ${profile.isHomelessOrAtRisk ? 'Yes' : 'No'}
- Current Needs: ${profile.needs.join(', ')}

Grant Eligibility Criteria:
${grant.otherCriteriaText}

Based on the veteran's profile and the grant's eligibility criteria, classify the veteran's eligibility as:
- "eligible": Clearly meets all requirements
- "ineligible": Clearly does not meet requirements
- "maybe": Unclear or requires additional information

Provide a brief reason for your classification.
  `.trim();
};

/**
 * Pattern-based classification fallback (temporary until LLM integration)
 */
const performPatternBasedClassification = async (
  profile: VeteranProfile,
  grant: any
): Promise<{ classification: 'eligible' | 'ineligible' | 'maybe'; confidence: number; reason: string }> => {
  const criteriaText = grant.otherCriteriaText.toLowerCase();

  // Check for income requirements
  if (criteriaText.includes('income') && criteriaText.includes('limit')) {
    if (!profile.annualHouseholdIncome) {
      return {
        classification: 'maybe',
        confidence: 0.6,
        reason: 'Income verification required'
      };
    }
  }

  // Check for family requirements
  if (criteriaText.includes('minor children') || criteriaText.includes('dependent')) {
    if (!profile.hasMinorChildren && criteriaText.includes('must have')) {
      return {
        classification: 'ineligible',
        confidence: 0.8,
        reason: 'Requires minor children in household'
      };
    }
  }

  // Check for homelessness requirements
  if (criteriaText.includes('homeless') && !profile.isHomelessOrAtRisk) {
    return {
      classification: 'ineligible',
      confidence: 0.7,
      reason: 'Requires homeless or at-risk status'
    };
  }

  // Default to eligible with moderate confidence
  return {
    classification: 'eligible',
    confidence: 0.7,
    reason: 'Meets basic criteria, complex requirements need review'
  };
};

/**
 * Prioritize matches using friction-adjusted scoring
 */
const prioritizeMatches = async (matches: GrantMatch[], profile: VeteranProfile): Promise<GrantMatch[]> => {
  try {
    // Calculate friction-adjusted scores
    for (const match of matches) {
      // Get grant friction score
      const grant = await dbUtils.get(`
        SELECT "frictionScore", "maxGrantAmount", "grantType"
        FROM grant_opportunities
        WHERE id = $1
      `, [match.grantId]);

      if (grant) {
        // Calculate friction-adjusted score
        const frictionPenalty = (grant.frictionScore - 1) / 9; // Normalize to 0-1
        const frictionAdjustedScore = match.matchScore * (1 - (frictionPenalty * 0.3));

        // Calculate recommendation priority
        const urgencyBonus = calculateUrgencyBonus(profile.needs, grant.grantType);
        const valueBonus = Math.min(0.2, (grant.maxGrantAmount || 0) / 50000); // Cap at $50k

        match.frictionAdjustedScore = Math.max(0, frictionAdjustedScore);
        match.recommendationPriority = Math.round(
          (frictionAdjustedScore + urgencyBonus + valueBonus) * 100
        );
      }
    }

    // Sort by recommendation priority (highest first)
    matches.sort((a, b) => b.recommendationPriority - a.recommendationPriority);

    dbLogger.info('Grant prioritization completed', {
      userId: profile.userId,
      totalMatches: matches.length,
      topPriority: matches[0]?.recommendationPriority || 0
    });

    return matches;

  } catch (error) {
    dbLogger.error('Grant prioritization failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profile.userId
    });
    return matches;
  }
};

/**
 * Calculate urgency bonus based on veteran needs and grant type
 */
const calculateUrgencyBonus = (needs: string[], grantType: string): number => {
  const urgentNeeds = ['rent', 'utilities', 'food', 'medical', 'emergency'];
  const hasUrgentNeed = needs.some(need =>
    urgentNeeds.some(urgent => need.toLowerCase().includes(urgent))
  );

  if (hasUrgentNeed && grantType && urgentNeeds.some(urgent =>
    grantType.toLowerCase().includes(urgent)
  )) {
    return 0.15; // 15% bonus for urgent need alignment
  }

  return 0;
};

/**
 * Store grant match results in database
 */
export const storeGrantMatches = async (
  userId: string,
  matches: GrantMatch[]
): Promise<void> => {
  try {
    // Clear existing matches for this user
    await dbUtils.run('DELETE FROM grant_matches WHERE "userId" = $1', [userId]);

    // Insert new matches
    for (const match of matches) {
      const matchId = crypto.randomUUID();

      await dbUtils.run(`
        INSERT INTO grant_matches (
          id, "userId", "grantId", "matchScore", "eligibilityStatus", "matchReason",
          "ruleBasedMatch", "llmClassification", "llmConfidence", "frictionAdjustedScore",
          "recommendationPriority", "lastChecked"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      `, [
        matchId,
        userId,
        match.grantId,
        match.matchScore,
        match.eligibilityStatus,
        match.matchReason,
        match.ruleBasedMatch,
        match.llmClassification,
        match.llmConfidence,
        match.frictionAdjustedScore,
        match.recommendationPriority
      ]);
    }

    dbLogger.info('Grant matches stored successfully', {
      userId,
      matchCount: matches.length
    });

  } catch (error) {
    dbLogger.error('Failed to store grant matches:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    throw error;
  }
};

/**
 * Get stored grant matches for a user
 */
export const getUserGrantMatches = async (
  userId: string,
  limit: number = 20
): Promise<GrantMatch[]> => {
  try {
    const matches = await dbUtils.all(`
      SELECT
        gm.*,
        go."grantName",
        go."grantingOrganization",
        go."requiredDocuments",
        go."actionableSteps",
        go."frictionScore"
      FROM grant_matches gm
      JOIN grant_opportunities go ON gm."grantId" = go.id
      WHERE gm."userId" = $1
      ORDER BY gm."recommendationPriority" DESC
      LIMIT $2
    `, [userId, limit]);

    return matches.map(match => ({
      grantId: match.grantId,
      grantName: match.grantName,
      grantingOrganization: match.grantingOrganization,
      matchScore: match.matchScore,
      eligibilityStatus: match.eligibilityStatus,
      matchReason: match.matchReason,
      ruleBasedMatch: Boolean(match.ruleBasedMatch),
      llmClassification: match.llmClassification,
      llmConfidence: match.llmConfidence,
      frictionAdjustedScore: match.frictionAdjustedScore,
      recommendationPriority: match.recommendationPriority,
      applicationMode: getRecommendedApplicationMode(match.frictionScore),
      actionableSteps: match.actionableSteps ? JSON.parse(match.actionableSteps) : [],
      requiredDocuments: match.requiredDocuments ? JSON.parse(match.requiredDocuments) : [],
      estimatedCompletionTime: estimateCompletionTime(match.frictionScore, getRecommendedApplicationMode(match.frictionScore))
    }));

  } catch (error) {
    dbLogger.error('Failed to get user grant matches:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
};

/**
 * Update grant match with user feedback
 */
export const updateGrantMatchFeedback = async (
  userId: string,
  grantId: string,
  feedback: string,
  applicationStarted?: boolean,
  applicationCompleted?: boolean,
  grantAwarded?: boolean
): Promise<void> => {
  try {
    const updates: string[] = [];
    const params: any[] = [];

    let paramIndex = 1;

    if (feedback) {
      updates.push(`"userFeedback" = $${paramIndex++}`);
      params.push(feedback);
    }

    if (applicationStarted !== undefined) {
      updates.push(`"applicationStarted" = $${paramIndex++}`);
      params.push(applicationStarted);
    }

    if (applicationCompleted !== undefined) {
      updates.push(`"applicationCompleted" = $${paramIndex++}`);
      params.push(applicationCompleted);
    }

    if (grantAwarded !== undefined) {
      updates.push(`"grantAwarded" = $${paramIndex++}`);
      params.push(grantAwarded);
    }

    if (updates.length > 0) {
      params.push(userId, grantId);

      await dbUtils.run(`
        UPDATE grant_matches
        SET ${updates.join(', ')}, "lastChecked" = CURRENT_TIMESTAMP
        WHERE "userId" = $${paramIndex++} AND "grantId" = $${paramIndex}
      `, params);

      dbLogger.info('Grant match feedback updated', {
        userId,
        grantId,
        feedback: !!feedback,
        applicationStarted,
        applicationCompleted,
        grantAwarded
      });
    }

  } catch (error) {
    dbLogger.error('Failed to update grant match feedback:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      grantId
    });
    throw error;
  }
};


