/**
 * @file Business Formation Routes
 * Express router for business formation API endpoints
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/index';
import { BusinessFormationService } from '@services/businessFormationService';
import { ValidationService } from '@services/validationService';
import { DocumentGenerationService } from '@services/documentGenerationService';
import { authenticateToken } from '@middleware/auth';
import { auditLogger } from '@utils/logger';
import { formBusiness } from '@controllers/businessController';
import {
  BusinessFormationRequest,
  validateWorkflowOwnership,
  validateCompanyOwnership,
  checkWorkflowStatus,
  businessFormationRateLimit,
  validateStepProgression,
  logBusinessFormationActivity,
  validateDocumentPermissions
} from '@middleware/businessFormation';
import {
  BusinessFormationPayload,
  LLCFormationPayload,
  WorkflowStepUpdateRequest,
  DocumentGenerationRequest,
  BusinessFormationResponse,
  BusinessEntityResponse,
  BusinessListResponse,
  DocumentGenerationResponse,
  WorkflowStepUpdateResponse
} from '../types/index';

const router = Router();

// Apply authentication middleware to all business routes
router.use(authenticateToken);

/**
 * POST /api/business/form
 * Legacy endpoint for Gemini's formBusiness controller
 * Delegates to comprehensive BusinessFormationService for full workflow management
 */
router.post('/form', formBusiness);

/**
 * POST /api/business/formation
 * Start a new business formation workflow
 */
router.post('/formation',
  businessFormationRateLimit,
  logBusinessFormationActivity('start_formation'),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Validate payload
    const validation = ValidationService.validateBusinessFormation(req.body);
    if (!validation.isValid) {
      auditLogger.warn('Business formation validation failed', {
        userId,
        errors: validation.errors,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validation.errors
      });
    }

    // Start formation workflow
    const result = await BusinessFormationService.startFormation(userId, validation.data!);
    
    auditLogger.info('Business formation started', {
      userId,
      workflowId: result.data?.workflowId,
      businessType: validation.data!.businessType,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('Business formation failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/formation/llc
 * Start a new LLC formation workflow with LLC-specific validation
 */
router.post('/formation/llc',
  businessFormationRateLimit,
  logBusinessFormationActivity('start_llc_formation'),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Validate LLC-specific payload
    const validation = ValidationService.validateLLCFormation(req.body);
    if (!validation.isValid) {
      auditLogger.warn('LLC formation validation failed', {
        userId,
        errors: validation.errors,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validation.errors
      });
    }

    // Start LLC formation workflow
    const result = await BusinessFormationService.startFormation(userId, validation.data!);
    
    auditLogger.info('LLC formation started', {
      userId,
      workflowId: result.data?.workflowId,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('LLC formation failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/business
 * Get user's businesses
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const result = await BusinessFormationService.getUserBusinesses(userId);
    
    auditLogger.info('User businesses retrieved', {
      userId,
      count: result.data?.total || 0,
      ip: req.ip
    });

    res.json(result);
  } catch (error) {
    auditLogger.error('Failed to get user businesses', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/business/workflow/:workflowId
 * Get business formation workflow details
 */
router.get('/workflow/:workflowId',
  validateWorkflowOwnership,
  logBusinessFormationActivity('get_workflow'),
  async (req: BusinessFormationRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    auditLogger.info('Workflow retrieved', {
      userId,
      workflowId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    auditLogger.error('Failed to get workflow', {
      userId: req.user?.id,
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/business/workflow/:workflowId/step
 * Update workflow step
 */
router.put('/workflow/:workflowId/step',
  validateWorkflowOwnership,
  checkWorkflowStatus(['in_progress']),
  validateStepProgression,
  logBusinessFormationActivity('update_workflow_step'),
  async (req: BusinessFormationRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Validate step update payload
    const validation = ValidationService.validateWorkflowStepUpdate({
      workflowId,
      ...req.body
    });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validation.errors
      });
    }

    const { stepId, stepData, markComplete } = validation.data!;
    
    const success = await BusinessFormationService.updateWorkflowStep(
      workflowId,
      userId,
      stepId,
      stepData,
      markComplete
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found or update failed'
      });
    }

    auditLogger.info('Workflow step updated', {
      userId,
      workflowId,
      stepId,
      markComplete,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        message: 'Workflow step updated successfully'
      }
    });
  } catch (error) {
    auditLogger.error('Failed to update workflow step', {
      userId: req.user?.id,
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/documents/generate
 * Generate business formation document
 */
router.post('/documents/generate',
  validateWorkflowOwnership,
  validateDocumentPermissions,
  logBusinessFormationActivity('generate_document'),
  async (req: BusinessFormationRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Validate document generation request
    const validation = ValidationService.validateDocumentGeneration(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validation.errors
      });
    }

    // Verify user owns the workflow
    const workflow = await BusinessFormationService.getWorkflow(validation.data!.workflowId, userId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const result = await DocumentGenerationService.generateDocument(validation.data!);

    auditLogger.info('Document generated', {
      userId,
      workflowId: validation.data!.workflowId,
      documentType: validation.data!.documentType,
      documentId: result.data?.documentId,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('Document generation failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/documents/form-205
 * Generate Texas Form 205 (Certificate of Formation)
 */
router.post('/documents/form-205', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId, formData } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Verify user owns the workflow
    const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const result = await DocumentGenerationService.generateForm205(workflowId, formData);

    auditLogger.info('Form 205 generated', {
      userId,
      workflowId,
      documentId: result.data?.documentId,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('Form 205 generation failed', {
      userId: req.user?.id,
      workflowId: req.body.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/documents/operating-agreement
 * Generate Operating Agreement
 */
router.post('/documents/operating-agreement', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId, companyData } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Verify user owns the workflow
    const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const result = await DocumentGenerationService.generateOperatingAgreement(workflowId, companyData);

    auditLogger.info('Operating agreement generated', {
      userId,
      workflowId,
      documentId: result.data?.documentId,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('Operating agreement generation failed', {
      userId: req.user?.id,
      workflowId: req.body.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/documents/ein-application
 * Generate EIN Application (SS-4)
 */
router.post('/documents/ein-application', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId, companyData } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Verify user owns the workflow
    const workflow = await BusinessFormationService.getWorkflow(workflowId, userId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const result = await DocumentGenerationService.generateEINApplication(workflowId, companyData);

    auditLogger.info('EIN application generated', {
      userId,
      workflowId,
      documentId: result.data?.documentId,
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    auditLogger.error('EIN application generation failed', {
      userId: req.user?.id,
      workflowId: req.body.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/business/documents/:documentId
 * Get generated document
 */
router.get('/documents/:documentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const document = await DocumentGenerationService.getDocument(documentId, userId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    auditLogger.info('Document accessed', {
      userId,
      documentId,
      filename: document.filename,
      ip: req.ip
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    res.send(document.content);
  } catch (error) {
    auditLogger.error('Document access failed', {
      userId: req.user?.id,
      documentId: req.params.documentId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/workflow/:workflowId/complete
 * Complete business formation workflow
 */
router.post('/workflow/:workflowId/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const success = await BusinessFormationService.completeWorkflow(workflowId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found or completion failed'
      });
    }

    auditLogger.info('Workflow completed', {
      userId,
      workflowId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        message: 'Workflow completed successfully'
      }
    });
  } catch (error) {
    auditLogger.error('Failed to complete workflow', {
      userId: req.user?.id,
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/business/workflow/:workflowId/cancel
 * Cancel business formation workflow
 */
router.post('/workflow/:workflowId/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workflowId } = req.params;
    const { reason } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const success = await BusinessFormationService.cancelWorkflow(workflowId, userId, reason);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found or cancellation failed'
      });
    }

    auditLogger.info('Workflow cancelled', {
      userId,
      workflowId,
      reason,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        message: 'Workflow cancelled successfully'
      }
    });
  } catch (error) {
    auditLogger.error('Failed to cancel workflow', {
      userId: req.user?.id,
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;



