/**
 * @file Bridge Service Adapter - Business Formation Integration Layer
 *
 * BRIDGE SERVICE ARCHITECTURE
 *
 * This service acts as the critical bridge between the simple, legacy business
 * formation interface and the comprehensive, enterprise-grade BusinessFormationService.
 * It serves as a translation layer that maintains backward compatibility while
 * unlocking the full power of the advanced workflow system.
 *
 * CORE RESPONSIBILITIES:
 *
 * 1. **Request Translation**: Converts simple business formation requests into
 *    the comprehensive workflow format required by BusinessFormationService
 *
 * 2. **Backward Compatibility**: Ensures existing integrations continue to work
 *    unchanged while gaining access to advanced features
 *
 * 3. **Response Simplification**: Transforms complex workflow responses back
 *    into the simple format expected by legacy endpoints
 *
 * 4. **Feature Bridging**: Provides access to advanced features (document
 *    generation, DocuSign integration, compliance tracking) through simple APIs
 *
 * INTEGRATION PATTERN:
 *
 * Simple Request → Bridge Service → Comprehensive Workflow → Bridge Service → Simple Response
 *
 * This architecture enables:
 * - Immediate compatibility with existing code
 * - Full access to enterprise-grade workflow features
 * - Seamless user experience regardless of endpoint complexity
 * - Future-proof design for continued development
 *
 * The bridge pattern ensures that simple integrations get the full benefit of
 * the sophisticated backend without requiring changes to their implementation.
 */

import { BusinessFormationService } from '../types/index';
import { ValidationService } from '../types/index';
import { dbLogger, auditLogger } from '../types/index';
import {
  BusinessFormationPayload,
  BusinessFormationResponse
} from '../types/businessTypes';

/**
 * User interface for legacy compatibility
 */
interface LegacyUser {
  id: string;
  email: string;
  role?: string;
}

/**
 * Legacy business formation result interface
 */
interface LegacyBusinessFormationResult {
  workflowId: string;
  companyId?: string;
  status: string;
  message: string;
  nextSteps?: string[];
  estimatedCompletion?: string;
}

/**
 * Initiate business formation (Legacy function for Gemini's controller)
 * 
 * This function maintains compatibility with the existing formBusiness controller
 * while delegating to the comprehensive BusinessFormationService implementation.
 * 
 * @param payload - Business formation payload from frontend
 * @param user - Authenticated user object
 * @returns Legacy-formatted business formation result
 */
export async function initiateBusinessFormation(
  payload: BusinessFormationPayload,
  user: LegacyUser
): Promise<LegacyBusinessFormationResult> {
  try {
    auditLogger.info('Legacy business formation initiated', {
      userId: user.id,
      businessName: payload.businessName,
      businessType: payload.businessType
    });

    // Validate the payload using the comprehensive validation service
    const validation = ValidationService.validateBusinessFormation(payload);
    if (!validation.isValid) {
      const errorMessage = `Validation failed: ${validation.errors?.join(', ')}`;
      
      auditLogger.warn('Legacy business formation validation failed', {
        userId: user.id,
        errors: validation.errors
      });
      
      throw new Error(errorMessage);
    }

    // Delegate to the comprehensive BusinessFormationService
    const result: BusinessFormationResponse = await BusinessFormationService.startFormation(
      user.id,
      validation.data!
    );

    if (!result.success) {
      throw new Error(result.error || 'Business formation failed');
    }

    // Transform the comprehensive result to legacy format
    const legacyResult: LegacyBusinessFormationResult = {
      workflowId: result.data!.workflowId,
      companyId: result.data!.companyId,
      status: 'initiated',
      message: 'Business formation workflow started successfully',
      nextSteps: result.data!.nextSteps,
      estimatedCompletion: result.data!.estimatedCompletion
    };

    auditLogger.info('Legacy business formation completed successfully', {
      userId: user.id,
      workflowId: legacyResult.workflowId,
      companyId: legacyResult.companyId
    });

    return legacyResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    dbLogger.error('Legacy business formation failed', {
      userId: user.id,
      businessName: payload.businessName,
      error: errorMessage
    });

    // Return error in legacy format
    return {
      workflowId: '',
      status: 'failed',
      message: `Business formation failed: ${errorMessage}`
    };
  }
}

/**
 * Get business formation status (Legacy function)
 * 
 * @param workflowId - Workflow ID to check
 * @param user - Authenticated user object
 * @returns Legacy-formatted status result
 */
export async function getBusinessFormationStatus(
  workflowId: string,
  user: LegacyUser
): Promise<{
  workflowId: string;
  status: string;
  currentStep: string;
  progress: number;
  message: string;
}> {
  try {
    const workflow = await BusinessFormationService.getWorkflow(workflowId, user.id);
    
    if (!workflow) {
      return {
        workflowId,
        status: 'not_found',
        currentStep: '',
        progress: 0,
        message: 'Workflow not found'
      };
    }

    // Calculate progress percentage
    const totalSteps = 10; // Default for LLC formation
    const progress = Math.round((workflow.completedSteps.length / totalSteps) * 100);

    return {
      workflowId,
      status: workflow.status,
      currentStep: workflow.currentStep,
      progress,
      message: `Workflow is ${workflow.status} at step: ${workflow.currentStep}`
    };
  } catch (error) {
    dbLogger.error('Failed to get business formation status', {
      workflowId,
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      workflowId,
      status: 'error',
      currentStep: '',
      progress: 0,
      message: 'Failed to retrieve workflow status'
    };
  }
}

/**
 * Get user's business entities (Legacy function)
 * 
 * @param user - Authenticated user object
 * @returns Legacy-formatted business list
 */
export async function getUserBusinesses(user: LegacyUser): Promise<{
  businesses: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    formationDate?: string;
    workflowId?: string;
  }>;
  total: number;
  message: string;
}> {
  try {
    const result = await BusinessFormationService.getUserBusinesses(user.id);
    
    if (!result.success || !result.data) {
      return {
        businesses: [],
        total: 0,
        message: result.error || 'Failed to retrieve businesses'
      };
    }

    // Transform to legacy format
    const businesses = result.data.businesses.map(business => ({
      id: business.id!,
      name: business.legalName,
      type: business.businessType,
      status: business.status,
      formationDate: business.formationDate,
      workflowId: business.workflow?.status ? business.id : undefined
    }));

    return {
      businesses,
      total: businesses.length,
      message: 'Businesses retrieved successfully'
    };
  } catch (error) {
    dbLogger.error('Failed to get user businesses', {
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      businesses: [],
      total: 0,
      message: 'Failed to retrieve businesses'
    };
  }
}

/**
 * Legacy business formation utilities
 */
export const BusinessServiceUtils = {
  /**
   * Validate business name availability (placeholder)
   */
  async validateBusinessName(businessName: string, state: string = 'TX'): Promise<{
    available: boolean;
    message: string;
  }> {
    // This would integrate with Texas SOS API in a real implementation
    // For now, return a placeholder response
    return {
      available: true,
      message: 'Business name validation not yet implemented'
    };
  },

  /**
   * Calculate estimated formation time
   */
  calculateEstimatedFormationTime(businessType: string): {
    estimatedDays: number;
    estimatedCost: number;
    message: string;
  } {
    const estimates: Record<string, { days: number; cost: number }> = {
      'LLC': { days: 7, cost: 300 },
      'Corporation': { days: 14, cost: 300 },
      'Partnership': { days: 10, cost: 200 }
    };

    const estimate = estimates[businessType] || estimates['LLC'];
    
    return {
      estimatedDays: estimate.days,
      estimatedCost: estimate.cost,
      message: `Estimated ${estimate.days} business days and $${estimate.cost} filing fee for ${businessType} formation in Texas`
    };
  },

  /**
   * Get required documents for business type
   */
  getRequiredDocuments(businessType: string): {
    documents: string[];
    message: string;
  } {
    const documentMap: Record<string, string[]> = {
      'LLC': ['Certificate of Formation (Form 205)', 'Operating Agreement', 'EIN Application (SS-4)'],
      'Corporation': ['Certificate of Incorporation', 'Bylaws', 'EIN Application (SS-4)'],
      'Partnership': ['Partnership Agreement', 'EIN Application (SS-4)']
    };

    const documents = documentMap[businessType] || documentMap['LLC'];
    
    return {
      documents,
      message: `Required documents for ${businessType} formation in Texas`
    };
  }
};

// Export legacy functions for backward compatibility
export {
  initiateBusinessFormation as formBusiness, // Alternative export name
  getBusinessFormationStatus as getFormationStatus,
  getUserBusinesses as getBusinessList
};



