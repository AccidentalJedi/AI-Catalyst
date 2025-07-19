import { dbLogger } from '@utils/logger';

// LLM Provider Configuration
interface LLMConfig {
  provider: 'ollama' | 'lmstudio' | 'openrouter';
  baseURL: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}

// Default LLM configurations
const LLM_CONFIGS: Record<string, LLMConfig> = {
  ollama: {
    provider: 'ollama',
    baseURL: 'http://localhost:11434',
    model: 'llama3.2:3b', // Efficient model for classification
    temperature: 0.1,
    maxTokens: 500
  },
  lmstudio: {
    provider: 'lmstudio',
    baseURL: 'http://localhost:1234',
    model: 'microsoft/DialoGPT-medium', // Or any loaded model
    temperature: 0.1,
    maxTokens: 500
  },
  openrouter: {
    provider: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'microsoft/wizardlm-2-8x22b', // Good for reasoning tasks
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: 0.1,
    maxTokens: 500
  }
};

// LLM classification interfaces
export interface ClassificationRequest {
  veteranProfile: {
    disabilityRating: number;
    isPermanentAndTotal: boolean;
    state: string;
    county: string;
    maritalStatus: string;
    hasMinorChildren: boolean;
    annualHouseholdIncome?: number;
    isHomelessOrAtRisk: boolean;
    serviceEra: string;
    branchOfService: string;
    dischargeType: string;
    needs: string[];
  };
  grantCriteria: {
    grantName: string;
    eligibilityCriteria: string;
    otherCriteriaText: string;
    targetPopulation: string[];
    residencyRequired: string[];
  };
}

export interface ClassificationResult {
  classification: 'eligible' | 'ineligible' | 'maybe';
  confidence: number;
  reason: string;
  keyFactors: string[];
  recommendedActions?: string[];
}

/**
 * LLM-powered eligibility classification service
 * Supports Ollama, LMStudio, and OpenRouter for flexible deployment
 */
export class LLMClassificationService {
  private static instance: LLMClassificationService;
  private currentConfig: LLMConfig;

  private constructor() {
    // Default to Ollama for local deployment, fallback to OpenRouter
    this.currentConfig = this.selectBestAvailableProvider();
  }

  public static getInstance(): LLMClassificationService {
    if (!LLMClassificationService.instance) {
      LLMClassificationService.instance = new LLMClassificationService();
    }
    return LLMClassificationService.instance;
  }

  /**
   * Select the best available LLM provider
   */
  private selectBestAvailableProvider(): LLMConfig {
    // Priority: Ollama (local) > LMStudio (local) > OpenRouter (API)
    if (process.env.OLLAMA_ENABLED === 'true') {
      return LLM_CONFIGS.ollama;
    } else if (process.env.LMSTUDIO_ENABLED === 'true') {
      return LLM_CONFIGS.lmstudio;
    } else if (process.env.OPENROUTER_API_KEY) {
      return LLM_CONFIGS.openrouter;
    } else {
      // Default to Ollama and log warning
      dbLogger.warn('No LLM provider configured, defaulting to Ollama');
      return LLM_CONFIGS.ollama;
    }
  }
  
  /**
   * Classify veteran eligibility for a grant using LLM
   */
  async classifyEligibility(request: ClassificationRequest): Promise<ClassificationResult> {
    try {
      dbLogger.info('Starting LLM eligibility classification', {
        grantName: request.grantCriteria.grantName,
        veteranState: request.veteranProfile.state,
        disabilityRating: request.veteranProfile.disabilityRating,
        provider: this.currentConfig.provider
      });

      // Try LLM inference first, fallback to pattern matching
      let result: ClassificationResult;

      try {
        result = await this.performLLMInference(request);
      } catch (llmError) {
        dbLogger.warn('LLM inference failed, falling back to pattern matching', {
          error: llmError instanceof Error ? llmError.message : 'Unknown error',
          provider: this.currentConfig.provider
        });
        result = await this.performAdvancedPatternClassification(request);
      }

      dbLogger.info('LLM classification completed', {
        grantName: request.grantCriteria.grantName,
        classification: result.classification,
        confidence: result.confidence,
        provider: this.currentConfig.provider
      });

      return result;

    } catch (error) {
      dbLogger.error('LLM classification failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        grantName: request.grantCriteria.grantName
      });

      return {
        classification: 'maybe',
        confidence: 0.5,
        reason: 'Classification failed, manual review recommended',
        keyFactors: ['Classification error occurred']
      };
    }
  }

  /**
   * Perform LLM inference for eligibility classification
   */
  private async performLLMInference(request: ClassificationRequest): Promise<ClassificationResult> {
    const prompt = this.constructClassificationPrompt(request);

    try {
      const response = await this.callLLMAPI(prompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      dbLogger.error('LLM API call failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.currentConfig.provider
      });
      throw error;
    }
  }

  /**
   * Call the configured LLM API
   */
  private async callLLMAPI(prompt: string): Promise<string> {
    const config = this.currentConfig;

    const requestBody = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert in veteran benefits eligibility. Analyze the veteran profile against grant criteria and provide a clear classification.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add API key for OpenRouter
    if (config.provider === 'openrouter' && config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['HTTP-Referer'] = 'https://ai-catalyst.local';
      headers['X-Title'] = 'AI Catalyst Grant Matching';
    }

    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid LLM API response format');
    }

    return data.choices[0].message.content;
  }
  
  /**
   * Construct optimized prompt for LLM classification
   */
  private constructClassificationPrompt(request: ClassificationRequest): string {
    const { veteranProfile, grantCriteria } = request;

    return `
TASK: Determine if this veteran is eligible for the specified grant.

VETERAN PROFILE:
- Disability Rating: ${veteranProfile.disabilityRating}% ${veteranProfile.isPermanentAndTotal ? '(P&T)' : ''}
- Location: ${veteranProfile.county}, ${veteranProfile.state}
- Marital Status: ${veteranProfile.maritalStatus}
- Minor Children: ${veteranProfile.hasMinorChildren ? 'Yes' : 'No'}
- Service Era: ${veteranProfile.serviceEra}
- Branch: ${veteranProfile.branchOfService}
- Discharge: ${veteranProfile.dischargeType}
- Annual Income: ${veteranProfile.annualHouseholdIncome ? '$' + veteranProfile.annualHouseholdIncome.toLocaleString() : 'Not provided'}
- Housing Status: ${veteranProfile.isHomelessOrAtRisk ? 'Homeless/At-risk' : 'Stable housing'}
- Current Needs: ${veteranProfile.needs.join(', ') || 'None specified'}

GRANT INFORMATION:
- Grant Name: ${grantCriteria.grantName}
- Target Population: ${grantCriteria.targetPopulation.join(', ')}
- Geographic Requirements: ${grantCriteria.residencyRequired.join(', ') || 'None specified'}
- Eligibility Criteria: ${grantCriteria.eligibilityCriteria}
- Additional Criteria: ${grantCriteria.otherCriteriaText}

INSTRUCTIONS:
Analyze the veteran's profile against the grant criteria. Respond with EXACTLY this format:

CLASSIFICATION: [eligible/ineligible/maybe]
CONFIDENCE: [0.0-1.0]
REASON: [Brief explanation of decision]
KEY_FACTORS: [List 2-3 most important factors that influenced the decision]
ACTIONS: [Recommended next steps for the veteran]

Be precise and consider all eligibility requirements carefully.
    `.trim();
  }

  /**
   * Parse LLM response into structured result
   */
  private parseLLMResponse(response: string): ClassificationResult {
    try {
      const lines = response.split('\n').map(line => line.trim()).filter(line => line);

      let classification: 'eligible' | 'ineligible' | 'maybe' = 'maybe';
      let confidence = 0.5;
      let reason = 'Unable to parse LLM response';
      let keyFactors: string[] = [];
      let recommendedActions: string[] = [];

      for (const line of lines) {
        if (line.startsWith('CLASSIFICATION:')) {
          const classValue = line.split(':')[1]?.trim().toLowerCase();
          if (classValue === 'eligible' || classValue === 'ineligible' || classValue === 'maybe') {
            classification = classValue;
          }
        } else if (line.startsWith('CONFIDENCE:')) {
          const confValue = parseFloat(line.split(':')[1]?.trim() || '0.5');
          confidence = Math.max(0, Math.min(1, confValue));
        } else if (line.startsWith('REASON:')) {
          reason = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('KEY_FACTORS:')) {
          const factors = line.split(':').slice(1).join(':').trim();
          keyFactors = factors.split(',').map(f => f.trim()).filter(f => f);
        } else if (line.startsWith('ACTIONS:')) {
          const actions = line.split(':').slice(1).join(':').trim();
          recommendedActions = actions.split(',').map(a => a.trim()).filter(a => a);
        }
      }

      return {
        classification,
        confidence,
        reason,
        keyFactors,
        recommendedActions
      };

    } catch (error) {
      dbLogger.error('Failed to parse LLM response:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        response: response.substring(0, 200)
      });

      return {
        classification: 'maybe',
        confidence: 0.5,
        reason: 'Failed to parse LLM response',
        keyFactors: ['Response parsing error']
      };
    }
  }

  /**
   * Advanced pattern-based classification (fallback implementation)
   */
  private async performAdvancedPatternClassification(
    request: ClassificationRequest
  ): Promise<ClassificationResult> {
    const { veteranProfile, grantCriteria } = request;
    const criteriaText = grantCriteria.otherCriteriaText.toLowerCase();
    const keyFactors: string[] = [];
    let confidence = 0.7;
    let classification: 'eligible' | 'ineligible' | 'maybe' = 'eligible';
    let reason = 'Meets basic eligibility requirements';
    
    // Income requirements analysis
    const incomeResult = this.analyzeIncomeRequirements(criteriaText, veteranProfile);
    if (incomeResult.impact !== 'neutral') {
      keyFactors.push(incomeResult.factor);
      confidence = Math.min(confidence, incomeResult.confidence);
      if (incomeResult.impact === 'negative') {
        classification = incomeResult.classification;
        reason = incomeResult.reason;
      }
    }
    
    // Family requirements analysis
    const familyResult = this.analyzeFamilyRequirements(criteriaText, veteranProfile);
    if (familyResult.impact !== 'neutral') {
      keyFactors.push(familyResult.factor);
      confidence = Math.min(confidence, familyResult.confidence);
      if (familyResult.impact === 'negative') {
        classification = familyResult.classification;
        reason = familyResult.reason;
      }
    }
    
    // Housing status analysis
    const housingResult = this.analyzeHousingRequirements(criteriaText, veteranProfile);
    if (housingResult.impact !== 'neutral') {
      keyFactors.push(housingResult.factor);
      confidence = Math.min(confidence, housingResult.confidence);
      if (housingResult.impact === 'negative') {
        classification = housingResult.classification;
        reason = housingResult.reason;
      }
    }
    
    // Service requirements analysis
    const serviceResult = this.analyzeServiceRequirements(criteriaText, veteranProfile);
    if (serviceResult.impact !== 'neutral') {
      keyFactors.push(serviceResult.factor);
      confidence = Math.min(confidence, serviceResult.confidence);
      if (serviceResult.impact === 'negative') {
        classification = serviceResult.classification;
        reason = serviceResult.reason;
      }
    }
    
    // Geographic requirements analysis
    const geoResult = this.analyzeGeographicRequirements(grantCriteria, veteranProfile);
    if (geoResult.impact !== 'neutral') {
      keyFactors.push(geoResult.factor);
      confidence = Math.min(confidence, geoResult.confidence);
      if (geoResult.impact === 'negative') {
        classification = geoResult.classification;
        reason = geoResult.reason;
      }
    }
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(classification, keyFactors, veteranProfile);
    
    return {
      classification,
      confidence,
      reason,
      keyFactors,
      recommendedActions
    };
  }
  
  /**
   * Analyze income requirements
   */
  private analyzeIncomeRequirements(criteriaText: string, profile: any): any {
    if (criteriaText.includes('income') && (criteriaText.includes('limit') || criteriaText.includes('below'))) {
      if (!profile.annualHouseholdIncome) {
        return {
          impact: 'negative',
          classification: 'maybe' as const,
          confidence: 0.6,
          factor: 'Income verification required',
          reason: 'Grant has income limits but veteran income is not provided'
        };
      }
      
      // Extract income limits (basic pattern matching)
      const incomeMatch = criteriaText.match(/\$?([\d,]+)/);
      if (incomeMatch) {
        const limit = parseInt(incomeMatch[1].replace(/,/g, ''));
        if (profile.annualHouseholdIncome > limit) {
          return {
            impact: 'negative',
            classification: 'ineligible' as const,
            confidence: 0.8,
            factor: `Income exceeds limit ($${limit.toLocaleString()})`,
            reason: `Veteran income ($${profile.annualHouseholdIncome.toLocaleString()}) exceeds grant limit`
          };
        }
      }
      
      return {
        impact: 'positive',
        confidence: 0.7,
        factor: 'Income requirements likely met'
      };
    }
    
    return { impact: 'neutral' };
  }
  
  /**
   * Analyze family requirements
   */
  private analyzeFamilyRequirements(criteriaText: string, profile: any): any {
    if (criteriaText.includes('minor children') || criteriaText.includes('dependent')) {
      if (criteriaText.includes('must have') || criteriaText.includes('required')) {
        if (!profile.hasMinorChildren) {
          return {
            impact: 'negative',
            classification: 'ineligible' as const,
            confidence: 0.8,
            factor: 'Requires minor children in household',
            reason: 'Grant requires minor children but veteran profile indicates none'
          };
        }
        
        return {
          impact: 'positive',
          confidence: 0.8,
          factor: 'Has required minor children'
        };
      }
    }
    
    return { impact: 'neutral' };
  }
  
  /**
   * Analyze housing status requirements
   */
  private analyzeHousingRequirements(criteriaText: string, profile: any): any {
    if (criteriaText.includes('homeless') || criteriaText.includes('at risk')) {
      if (criteriaText.includes('must be') || criteriaText.includes('only')) {
        if (!profile.isHomelessOrAtRisk) {
          return {
            impact: 'negative',
            classification: 'ineligible' as const,
            confidence: 0.7,
            factor: 'Requires homeless or at-risk status',
            reason: 'Grant is specifically for homeless/at-risk veterans'
          };
        }
        
        return {
          impact: 'positive',
          confidence: 0.8,
          factor: 'Meets homeless/at-risk requirement'
        };
      }
    }
    
    return { impact: 'neutral' };
  }
  
  /**
   * Analyze service requirements
   */
  private analyzeServiceRequirements(criteriaText: string, profile: any): any {
    // Check for specific service era requirements
    if (criteriaText.includes('post-9/11') || criteriaText.includes('post 9/11')) {
      if (profile.serviceEra !== 'post-9/11') {
        return {
          impact: 'negative',
          classification: 'ineligible' as const,
          confidence: 0.8,
          factor: 'Requires post-9/11 service era',
          reason: 'Grant is limited to post-9/11 veterans'
        };
      }
    }
    
    // Check for discharge type requirements
    if (criteriaText.includes('honorable discharge')) {
      if (profile.dischargeType !== 'honorable') {
        return {
          impact: 'negative',
          classification: 'maybe' as const,
          confidence: 0.7,
          factor: 'May require honorable discharge',
          reason: 'Grant may require honorable discharge status'
        };
      }
    }
    
    return { impact: 'neutral' };
  }
  
  /**
   * Analyze geographic requirements
   */
  private analyzeGeographicRequirements(grantCriteria: any, profile: any): any {
    if (grantCriteria.residencyRequired && grantCriteria.residencyRequired.length > 0) {
      const hasStateMatch = grantCriteria.residencyRequired.includes(profile.state);
      const hasCountyMatch = grantCriteria.residencyRequired.includes(profile.county);
      
      if (!hasStateMatch && !hasCountyMatch) {
        return {
          impact: 'negative',
          classification: 'ineligible' as const,
          confidence: 0.9,
          factor: 'Geographic restrictions not met',
          reason: `Grant limited to specific areas, veteran in ${profile.county}, ${profile.state}`
        };
      }
      
      return {
        impact: 'positive',
        confidence: 0.8,
        factor: 'Meets geographic requirements'
      };
    }
    
    return { impact: 'neutral' };
  }
  
  /**
   * Generate recommended actions based on classification
   */
  private generateRecommendedActions(
    classification: string,
    keyFactors: string[],
    profile: any
  ): string[] {
    const actions: string[] = [];
    
    if (classification === 'maybe') {
      actions.push('Contact grant organization to verify eligibility');
      
      if (keyFactors.some(f => f.includes('income'))) {
        actions.push('Gather income documentation for verification');
      }
      
      if (keyFactors.some(f => f.includes('children'))) {
        actions.push('Verify dependent status and gather documentation');
      }
    }
    
    if (classification === 'eligible') {
      actions.push('Proceed with application preparation');
      actions.push('Gather required documentation');
    }
    
    if (classification === 'ineligible') {
      actions.push('Consider alternative grant opportunities');
      actions.push('Review eligibility criteria for potential changes');
    }
    
    return actions;
  }
}


