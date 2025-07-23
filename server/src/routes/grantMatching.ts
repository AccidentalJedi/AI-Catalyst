import { Router, Response } from 'express';
import { AuthenticatedRequest, VeteranProfile } from '../types/index';
import { findMatchingGrants, storeGrantMatches, getUserGrantMatches, updateGrantMatchFeedback } from '@services/grantMatchingService';
import { dbLogger } from '@utils/logger';
import { authenticateToken } from '@middleware/auth';
import { dbUtils } from '@utils/databaseAdapter';

const router = Router();

/**
 * Find matching grants for a veteran profile
 */
router.post('/find', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const {
      disabilityRating = 100,
      isPermanentAndTotal = true,
      state = 'TX',
      county,
      maritalStatus = 'single',
      hasMinorChildren = false,
      annualHouseholdIncome,
      isHomelessOrAtRisk = false,
      serviceEra = 'post-9/11',
      branchOfService,
      dischargeType = 'honorable',
      needs = [],
      availableDocuments = [],
      limit = 20
    } = req.body;

    // Validate required fields
    if (!county) {
      return res.status(400).json({
        success: false,
        error: 'County is required for grant matching'
      });
    }

    // Build veteran profile
    const veteranProfile: VeteranProfile = {
      userId,
      disabilityRating,
      isPermanentAndTotal,
      state,
      county,
      maritalStatus,
      hasMinorChildren,
      annualHouseholdIncome,
      isHomelessOrAtRisk,
      serviceEra,
      branchOfService: branchOfService || '',
      dischargeType,
      needs,
      availableDocuments
    };

    // Find matching grants
    const matches = await findMatchingGrants(veteranProfile, limit);

    // Store matches in database
    await storeGrantMatches(userId, matches);

    res.json({
      success: true,
      data: {
        matches,
        totalFound: matches.length,
        profile: veteranProfile,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    dbLogger.error('Grant matching failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to find matching grants'
    });
  }
});

/**
 * Get stored grant matches for the current user
 */
router.get('/matches', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const matches = getUserGrantMatches(userId, limit);

    res.json({
      success: true,
      data: {
        matches,
        totalFound: matches.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    dbLogger.error('Failed to get grant matches:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get grant matches'
    });
  }
});

/**
 * Update grant match with user feedback
 */
router.post('/matches/:grantId/feedback', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { grantId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const {
      feedback,
      applicationStarted,
      applicationCompleted,
      grantAwarded
    } = req.body;

    await updateGrantMatchFeedback(
      userId,
      grantId,
      feedback,
      applicationStarted,
      applicationCompleted,
      grantAwarded
    );

    res.json({
      success: true,
      message: 'Grant match feedback updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    dbLogger.error('Failed to update grant match feedback:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      grantId: req.params.grantId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update grant match feedback'
    });
  }
});

/**
 * Get grant matching statistics for the user
 */
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get user's grant matching statistics
    const stats = await dbUtils.get(`
      SELECT
        COUNT(*) as "totalMatches",
        COUNT(CASE WHEN "eligibilityStatus" = 'eligible' THEN 1 END) as "eligibleMatches",
        COUNT(CASE WHEN "applicationStarted" = true THEN 1 END) as "applicationsStarted",
        COUNT(CASE WHEN "applicationCompleted" = true THEN 1 END) as "applicationsCompleted",
        COUNT(CASE WHEN "grantAwarded" = true THEN 1 END) as "grantsAwarded",
        AVG("frictionAdjustedScore") as "averageScore",
        MAX("lastChecked") as "lastMatchDate"
      FROM grant_matches
      WHERE "userId" = $1
    `, [userId]);

    // Get top grant types by match count
    const topGrantTypes = await dbUtils.all(`
      SELECT
        go."grantType",
        COUNT(*) as "matchCount",
        AVG(gm."frictionAdjustedScore") as "averageScore"
      FROM grant_matches gm
      JOIN grant_opportunities go ON gm."grantId" = go.id
      WHERE gm."userId" = $1
      GROUP BY go."grantType"
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `, [userId]);

    // Get recent matches
    const recentMatches = dbUtils.all(`
      SELECT 
        gm.grantId,
        go.grantName,
        go.grantingOrganization,
        gm.eligibilityStatus,
        gm.frictionAdjustedScore,
        gm.lastChecked
      FROM grant_matches gm
      JOIN grant_opportunities go ON gm.grantId = go.id
      WHERE gm.userId = ?
      ORDER BY gm.lastChecked DESC
      LIMIT 5
    `, [userId]);

    res.json({
      success: true,
      data: {
        overview: stats,
        topGrantTypes,
        recentMatches,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    dbLogger.error('Failed to get grant matching statistics:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get grant matching statistics'
    });
  }
});

/**
 * Get detailed information about a specific grant
 */
router.get('/grants/:grantId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { grantId } = req.params;
    
    const grant = dbUtils.get(`
      SELECT 
        id, grantName, grantingOrganization, grantDescription,
        grantType, maxGrantAmount, eligibilityCriteria,
        otherCriteriaText, applicationProcess, applicationURL,
        requiredDocuments, actionableSteps, frictionScore,
        documentationBurden, processSteps, thirdPartyDependency,
        ambiguityGatekeeping, submissionMode, pointOfContact,
        averageProcessingTime, successRate, lastUpdated
      FROM grant_opportunities 
      WHERE id = ? AND isActive = 1
    `, [grantId]);

    if (!grant) {
      return res.status(404).json({
        success: false,
        error: 'Grant not found'
      });
    }

    // Parse JSON fields
    const grantDetails = {
      ...grant,
      eligibilityCriteria: grant.eligibilityCriteria ? JSON.parse(grant.eligibilityCriteria) : null,
      applicationProcess: grant.applicationProcess ? JSON.parse(grant.applicationProcess) : null,
      requiredDocuments: grant.requiredDocuments ? JSON.parse(grant.requiredDocuments) : [],
      actionableSteps: grant.actionableSteps ? JSON.parse(grant.actionableSteps) : [],
      pointOfContact: grant.pointOfContact ? JSON.parse(grant.pointOfContact) : null
    };

    res.json({
      success: true,
      data: {
        grant: grantDetails,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    dbLogger.error('Failed to get grant details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      grantId: req.params.grantId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get grant details'
    });
  }
});

/**
 * Search grants by criteria
 */
router.get('/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      query,
      grantType,
      maxFrictionScore = 10,
      minAmount,
      maxAmount,
      state = 'TX',
      limit = 20
    } = req.query;

    let sql = `
      SELECT 
        id, grantName, grantingOrganization, grantType,
        maxGrantAmount, frictionScore, grantDescription
      FROM grant_opportunities 
      WHERE isActive = 1
    `;
    
    const params: any[] = [];

    if (query) {
      sql += ` AND (grantName LIKE ? OR grantDescription LIKE ? OR grantingOrganization LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (grantType) {
      sql += ` AND grantType = ?`;
      params.push(grantType);
    }

    if (maxFrictionScore) {
      sql += ` AND frictionScore <= ?`;
      params.push(maxFrictionScore);
    }

    if (minAmount) {
      sql += ` AND maxGrantAmount >= ?`;
      params.push(minAmount);
    }

    if (maxAmount) {
      sql += ` AND maxGrantAmount <= ?`;
      params.push(maxAmount);
    }

    sql += ` ORDER BY frictionScore ASC, maxGrantAmount DESC LIMIT ?`;
    params.push(limit);

    const grants = dbUtils.all(sql, params);

    res.json({
      success: true,
      data: {
        grants,
        totalFound: grants.length,
        searchCriteria: {
          query,
          grantType,
          maxFrictionScore,
          minAmount,
          maxAmount,
          state,
          limit
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    dbLogger.error('Grant search failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: 'Grant search failed'
    });
  }
});

export default router;



