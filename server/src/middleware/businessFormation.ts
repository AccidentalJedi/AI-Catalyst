/**
 * @file Business Formation Middleware
 * Specialized middleware for business formation request handling
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index';
import { BusinessFormationService } from '../types/index';
import { auditLogger, dbLogger } from '../types/index';
import { dbUtils } from '@utils/database';

/**
 * Extended Request interface for business formation
 */
export interface BusinessFormationRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  businessFormation?: {
    workflow?: any;
    company?: any;
    permissions?: string[];
  };
}

/**
 * Middleware to validate workflow ownership
 */
export const validateWorkflowOwnership = async (
  req: BusinessFormationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const workflowId = req.params.workflowId || req.body.workflowId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: 'Workflow ID is required'
      });
    }

    // Get workflow and verify ownership
    const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
    
    if (!workflow) {
      auditLogger.warn('Unauthorized workflow access attempt', {
        userId,
        workflowId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(404).json({
        success: false,
        error: 'Workflow not found or access denied'
      });
    }

    // Attach workflow to request for downstream use
    req.businessFormation = {
      workflow,
      permissions: ['read', 'write', 'delete']
    };

    auditLogger.info('Workflow access authorized', {
      userId,
      workflowId,
      workflowType: workflow.workflowType,
      workflowStatus: workflow.status,
      ip: req.ip
    });

    next();
  } catch (error) {
    dbLogger.error('Workflow ownership validation failed', {
      userId: req.user?.id,
      workflowId: req.params.workflowId || req.body.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to validate company ownership
 */
export const validateCompanyOwnership = async (
  req: BusinessFormationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const companyId = req.params.companyId || req.body.companyId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Get company and verify ownership
    const company = dbUtils.get(`
      SELECT * FROM companies WHERE id = ? AND userId = ?
    `, [companyId, userId]);
    
    if (!company) {
      auditLogger.warn('Unauthorized company access attempt', {
        userId,
        companyId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(404).json({
        success: false,
        error: 'Company not found or access denied'
      });
    }

    // Attach company to request for downstream use
    req.businessFormation = {
      ...req.businessFormation,
      company,
      permissions: ['read', 'write', 'delete']
    };

    auditLogger.info('Company access authorized', {
      userId,
      companyId,
      companyName: company.legalName,
      ip: req.ip
    });

    next();
  } catch (error) {
    dbLogger.error('Company ownership validation failed', {
      userId: req.user?.id,
      companyId: req.params.companyId || req.body.companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to check workflow status for operations
 */
export const checkWorkflowStatus = (allowedStatuses: string[]) => {
  return (req: BusinessFormationRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = req.businessFormation?.workflow;
      
      if (!workflow) {
        return res.status(400).json({
          success: false,
          error: 'Workflow context not found'
        });
      }

      if (!allowedStatuses.includes(workflow.status)) {
        auditLogger.warn('Operation blocked due to workflow status', {
          userId: req.user?.id,
          workflowId: workflow.id,
          currentStatus: workflow.status,
          allowedStatuses,
          operation: req.method + ' ' + req.path,
          ip: req.ip
        });

        return res.status(409).json({
          success: false,
          error: `Operation not allowed for workflow status: ${workflow.status}`,
          currentStatus: workflow.status,
          allowedStatuses
        });
      }

      next();
    } catch (error) {
      dbLogger.error('Workflow status check failed', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to rate limit business formation operations
 */
export const businessFormationRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // This could be enhanced with Redis for distributed rate limiting
  // For now, we'll use a simple in-memory approach
  
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  // Check for excessive business formation attempts
  const key = `business_formation_${userId}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxAttempts = 10; // Max 10 business formations per hour

  // In a production environment, this should use Redis or a proper cache
  // For now, we'll just log and continue
  auditLogger.info('Business formation rate limit check', {
    userId,
    ip: req.ip,
    timestamp: now
  });

  next();
};

/**
 * Middleware to validate business formation step progression
 */
export const validateStepProgression = (req: BusinessFormationRequest, res: Response, next: NextFunction) => {
  try {
    const workflow = req.businessFormation?.workflow;
    const { stepId } = req.body;
    
    if (!workflow || !stepId) {
      return next();
    }

    // Define step progression rules
    const stepProgressionRules: Record<string, string[]> = {
      'business_info': ['registered_agent'],
      'registered_agent': ['business_address'],
      'business_address': ['organizers', 'incorporators', 'partners'],
      'organizers': ['management_structure'],
      'incorporators': ['directors'],
      'partners': ['partnership_agreement'],
      'management_structure': ['operating_agreement'],
      'directors': ['bylaws'],
      'partnership_agreement': ['document_generation'],
      'operating_agreement': ['document_generation'],
      'bylaws': ['document_generation'],
      'document_generation': ['review_submit'],
      'review_submit': ['filing'],
      'filing': ['completion']
    };

    const currentStep = workflow.currentStep;
    const allowedNextSteps = stepProgressionRules[currentStep] || [];
    
    // Allow updating current step or progressing to next allowed step
    if (stepId !== currentStep && !allowedNextSteps.includes(stepId)) {
      auditLogger.warn('Invalid step progression attempt', {
        userId: req.user?.id,
        workflowId: workflow.id,
        currentStep,
        attemptedStep: stepId,
        allowedSteps: allowedNextSteps,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid step progression',
        currentStep,
        allowedNextSteps
      });
    }

    next();
  } catch (error) {
    dbLogger.error('Step progression validation failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to log business formation activities
 */
export const logBusinessFormationActivity = (activity: string) => {
  return (req: BusinessFormationRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the activity after response is sent
      const success = res.statusCode >= 200 && res.statusCode < 300;
      
      auditLogger.info('Business formation activity', {
        activity,
        userId: req.user?.id,
        workflowId: req.businessFormation?.workflow?.id,
        companyId: req.businessFormation?.company?.id,
        success,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to validate document generation permissions
 */
export const validateDocumentPermissions = (req: BusinessFormationRequest, res: Response, next: NextFunction) => {
  try {
    const workflow = req.businessFormation?.workflow;
    const { documentType } = req.body;
    
    if (!workflow) {
      return res.status(400).json({
        success: false,
        error: 'Workflow context required for document generation'
      });
    }

    // Check if workflow is in appropriate state for document generation
    const allowedStatuses = ['in_progress', 'completed'];
    if (!allowedStatuses.includes(workflow.status)) {
      return res.status(409).json({
        success: false,
        error: 'Document generation not allowed for current workflow status',
        currentStatus: workflow.status
      });
    }

    // Validate document type matches workflow type
    const workflowDocumentMap: Record<string, string[]> = {
      'llc_formation': ['form_205', 'operating_agreement', 'ein_application'],
      'corporation_formation': ['certificate_of_incorporation', 'bylaws', 'ein_application'],
      'partnership_formation': ['partnership_agreement', 'ein_application']
    };

    const allowedDocuments = workflowDocumentMap[workflow.workflowType] || [];
    if (documentType && !allowedDocuments.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: 'Document type not allowed for this workflow type',
        workflowType: workflow.workflowType,
        allowedDocuments
      });
    }

    next();
  } catch (error) {
    dbLogger.error('Document permissions validation failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// BusinessFormationRequest is already exported above



