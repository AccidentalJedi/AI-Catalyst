import { Router } from 'express';
import { LLMConfigService } from '@services/llmConfigService';
import { LLMClassificationService } from '@services/llmClassificationService';
import { dbLogger } from '@utils/logger';
import { authenticateToken } from '@middleware/auth';

const router = Router();

/**
 * Get LLM provider health status
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const configService = LLMConfigService.getInstance();
    const healthStatus = configService.getProviderHealthStatus();
    
    res.json({
      success: true,
      data: {
        providers: healthStatus,
        lastChecked: new Date().toISOString()
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to get LLM health status:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM health status'
    });
  }
});

/**
 * Refresh LLM provider health status
 */
router.post('/health/refresh', authenticateToken, async (req, res) => {
  try {
    const configService = LLMConfigService.getInstance();
    await configService.refreshHealthStatus();
    
    const healthStatus = configService.getProviderHealthStatus();
    
    res.json({
      success: true,
      data: {
        providers: healthStatus,
        refreshed: new Date().toISOString()
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to refresh LLM health status:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to refresh LLM health status'
    });
  }
});

/**
 * Get LLM configuration validation
 */
router.get('/config/validate', authenticateToken, async (req, res) => {
  try {
    const configService = LLMConfigService.getInstance();
    const validation = configService.validateConfiguration();
    const recommendedModels = configService.getRecommendedModels();
    
    res.json({
      success: true,
      data: {
        validation,
        recommendedModels,
        environment: {
          ollamaEnabled: process.env.OLLAMA_ENABLED === 'true',
          lmstudioEnabled: process.env.LMSTUDIO_ENABLED === 'true',
          openrouterConfigured: !!process.env.OPENROUTER_API_KEY
        }
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to validate LLM configuration:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to validate LLM configuration'
    });
  }
});

/**
 * Test a specific LLM provider
 */
router.post('/test/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    
    if (!['ollama', 'lmstudio', 'openrouter'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Must be ollama, lmstudio, or openrouter'
      });
    }
    
    const configService = LLMConfigService.getInstance();
    const testResult = await configService.testProvider(provider);
    
    res.json({
      success: true,
      data: {
        provider,
        testResult,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to test LLM provider:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: req.params.provider
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to test LLM provider'
    });
  }
});

/**
 * Test LLM classification with sample data
 */
router.post('/test/classification', authenticateToken, async (req, res) => {
  try {
    const llmService = LLMClassificationService.getInstance();
    
    // Sample classification request
    const sampleRequest = {
      veteranProfile: {
        disabilityRating: 100,
        isPermanentAndTotal: true,
        state: 'TX',
        county: 'Harris',
        maritalStatus: 'married',
        hasMinorChildren: true,
        annualHouseholdIncome: 45000,
        isHomelessOrAtRisk: false,
        serviceEra: 'post-9/11',
        branchOfService: 'Army',
        dischargeType: 'honorable',
        needs: ['rent', 'utilities']
      },
      grantCriteria: {
        grantName: 'Emergency Financial Assistance',
        eligibilityCriteria: 'Veterans with service-connected disabilities',
        otherCriteriaText: 'Must have minor children and household income below $50,000',
        targetPopulation: ['veteran'],
        residencyRequired: ['TX', 'Harris County']
      }
    };
    
    const startTime = Date.now();
    const result = await llmService.classifyEligibility(sampleRequest);
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        classification: result,
        responseTime,
        sampleRequest,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to test LLM classification:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to test LLM classification'
    });
  }
});

/**
 * Get current LLM provider configuration
 */
router.get('/config/current', authenticateToken, async (req, res) => {
  try {
    const configService = LLMConfigService.getInstance();
    const bestProvider = await configService.getBestProvider();
    const providerConfig = configService.getProviderConfig(bestProvider);
    
    // Remove sensitive information
    const sanitizedConfig = {
      ...providerConfig,
      apiKey: providerConfig.apiKey ? '***configured***' : undefined
    };
    
    res.json({
      success: true,
      data: {
        currentProvider: bestProvider,
        config: sanitizedConfig,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to get current LLM configuration:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get current LLM configuration'
    });
  }
});

/**
 * Get LLM usage statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement usage statistics tracking
    // This would track classification requests, response times, success rates, etc.
    
    res.json({
      success: true,
      data: {
        message: 'LLM usage statistics not yet implemented',
        placeholder: {
          totalClassifications: 0,
          averageResponseTime: 0,
          successRate: 0,
          providerUsage: {}
        }
      }
    });
    
  } catch (error) {
    dbLogger.error('Failed to get LLM statistics:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get LLM statistics'
    });
  }
});

export default router;


