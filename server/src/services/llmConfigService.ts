import { dbLogger } from '@utils/logger';

// LLM Provider Health Check Interface
interface ProviderHealthCheck {
  provider: string;
  available: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * LLM Configuration and Health Monitoring Service
 * Manages multiple LLM providers and automatic failover
 */
export class LLMConfigService {
  private static instance: LLMConfigService;
  private healthCheckCache: Map<string, ProviderHealthCheck> = new Map();
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  public static getInstance(): LLMConfigService {
    if (!LLMConfigService.instance) {
      LLMConfigService.instance = new LLMConfigService();
    }
    return LLMConfigService.instance;
  }
  
  /**
   * Get the best available LLM provider with health checking
   */
  async getBestProvider(): Promise<string> {
    try {
      // Check if we need to refresh health status
      const now = Date.now();
      if (now - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
        await this.performHealthChecks();
        this.lastHealthCheck = now;
      }
      
      // Priority order: Ollama (local) > LMStudio (local) > OpenRouter (API)
      const providers = ['ollama', 'lmstudio', 'openrouter'];
      
      for (const provider of providers) {
        const health = this.healthCheckCache.get(provider);
        if (health?.available) {
          dbLogger.info('Selected LLM provider', {
            provider,
            responseTime: health.responseTime
          });
          return provider;
        }
      }
      
      // If no providers are available, default to OpenRouter with warning
      dbLogger.warn('No LLM providers available, defaulting to OpenRouter');
      return 'openrouter';
      
    } catch (error) {
      dbLogger.error('Failed to determine best LLM provider:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 'openrouter'; // Safe fallback
    }
  }
  
  /**
   * Perform health checks on all configured providers
   */
  private async performHealthChecks(): Promise<void> {
    const providers = [
      { name: 'ollama', url: 'http://localhost:11434/api/tags' },
      { name: 'lmstudio', url: 'http://localhost:1234/v1/models' },
      { name: 'openrouter', url: 'https://openrouter.ai/api/v1/models' }
    ];
    
    const healthChecks = providers.map(provider => this.checkProviderHealth(provider));
    await Promise.allSettled(healthChecks);
  }
  
  /**
   * Check health of a specific provider
   */
  private async checkProviderHealth(provider: { name: string; url: string }): Promise<void> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const headers: Record<string, string> = {};
      
      // Add auth for OpenRouter
      if (provider.name === 'openrouter' && process.env.OPENROUTER_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
      }
      
      const response = await fetch(provider.url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        this.healthCheckCache.set(provider.name, {
          provider: provider.name,
          available: true,
          responseTime
        });
        
        dbLogger.debug('Provider health check passed', {
          provider: provider.name,
          responseTime
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.healthCheckCache.set(provider.name, {
        provider: provider.name,
        available: false,
        responseTime,
        error: errorMessage
      });
      
      dbLogger.debug('Provider health check failed', {
        provider: provider.name,
        error: errorMessage,
        responseTime
      });
    }
  }
  
  /**
   * Get health status of all providers
   */
  getProviderHealthStatus(): ProviderHealthCheck[] {
    return Array.from(this.healthCheckCache.values());
  }
  
  /**
   * Force refresh of provider health status
   */
  async refreshHealthStatus(): Promise<void> {
    await this.performHealthChecks();
    this.lastHealthCheck = Date.now();
  }
  
  /**
   * Get recommended model for each provider
   */
  getRecommendedModels(): Record<string, string> {
    return {
      ollama: 'llama3.2:3b', // Fast and efficient for classification
      lmstudio: 'microsoft/DialoGPT-medium', // Good general purpose model
      openrouter: 'microsoft/wizardlm-2-8x22b' // Excellent reasoning capabilities
    };
  }
  
  /**
   * Validate LLM configuration
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check environment variables
    if (!process.env.OPENROUTER_API_KEY) {
      issues.push('OPENROUTER_API_KEY not configured - OpenRouter will not be available');
    }
    
    // Check if at least one local provider is likely available
    const hasLocalProvider = process.env.OLLAMA_ENABLED === 'true' || 
                            process.env.LMSTUDIO_ENABLED === 'true';
    
    if (!hasLocalProvider && !process.env.OPENROUTER_API_KEY) {
      issues.push('No LLM providers configured - classification will use pattern matching fallback');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * Get optimal configuration for a provider
   */
  getProviderConfig(provider: string): any {
    const baseConfigs = {
      ollama: {
        baseURL: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.1,
        maxTokens: 500,
        timeout: 30000
      },
      lmstudio: {
        baseURL: 'http://localhost:1234',
        model: 'microsoft/DialoGPT-medium',
        temperature: 0.1,
        maxTokens: 500,
        timeout: 30000
      },
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'microsoft/wizardlm-2-8x22b',
        apiKey: process.env.OPENROUTER_API_KEY,
        temperature: 0.1,
        maxTokens: 500,
        timeout: 60000
      }
    };
    
    return baseConfigs[provider as keyof typeof baseConfigs] || baseConfigs.openrouter;
  }
  
  /**
   * Test LLM provider with a simple classification task
   */
  async testProvider(provider: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const config = this.getProviderConfig(provider);
      
      const testPrompt = `
TASK: Classify eligibility as eligible, ineligible, or maybe.

VETERAN: 100% disabled veteran in Texas
GRANT: Texas property tax exemption for 100% disabled veterans

CLASSIFICATION: eligible
CONFIDENCE: 0.95
REASON: Veteran meets all requirements
      `.trim();
      
      const requestBody = {
        model: config.model,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.1,
        max_tokens: 100
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (provider === 'openrouter' && config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
      
      const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.choices && data.choices[0]) {
          return { success: true, responseTime };
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}


