import { Router, Response, NextFunction } from 'express';
import { DocuSignService } from '@services/docusignService';
import { authenticateToken } from '@middleware/auth';
import { docusignLogger } from '@utils/logger';
import { AuthenticatedRequest } from '../types/index';
import { z } from 'zod';

const router = Router();

// Apply authentication middleware to all DocuSign routes
router.use(authenticateToken);

// Initialize DocuSign service instance
const docusignService = new DocuSignService();

// Simple Zod validation middleware
const validateZodSchema = (schema: z.ZodSchema) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues
        });
      }
      next(error);
    }
  };
};

// Validation schemas
const form205Schema = z.object({
  documentName: z.string().min(1),
  signerEmail: z.string().email(),
  signerName: z.string().min(1),
  companyName: z.string().min(1),
  registeredAgentName: z.string().min(1),
  registeredAgentAddress: z.string().min(1),
  managementStructure: z.string().min(1),
  purpose: z.string().min(1),
});

const operatingAgreementSchema = z.object({
  documentName: z.string().min(1),
  signerEmail: z.string().email(),
  signerName: z.string().min(1),
  companyName: z.string().min(1),
  memberName: z.string().min(1),
  membershipPercentage: z.string().min(1),
  effectiveDate: z.string().min(1),
  managementStructure: z.string().min(1),
  initialCapital: z.string().min(1),
});

const einApplicationSchema = z.object({
  documentName: z.string().min(1),
  signerEmail: z.string().email(),
  signerName: z.string().min(1),
  companyName: z.string().min(1),
  businessAddress: z.string().min(1),
  mailingAddress: z.string().min(1),
  streetAddress: z.string().min(1),
  responsiblePartyName: z.string().min(1),
  responsiblePartySSN: z.string().min(1),
});

const embeddedSigningSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  clientUserId: z.string().min(1),
});

/**
 * POST /api/v1/docusign/authenticate
 * Authenticate with DocuSign using JWT
 */
router.post('/authenticate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    docusignLogger.info('DocuSign authentication requested', { userId: req.user?.id });
    
    const result = await docusignService.authenticate();
    
    if (result.success) {
      docusignLogger.info('DocuSign authentication successful', { userId: req.user?.id });
      res.json(result);
    } else {
      docusignLogger.error('DocuSign authentication failed', { 
        userId: req.user?.id, 
        error: result.error 
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('DocuSign authentication error', { 
      userId: req.user?.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during authentication'
    });
  }
});

/**
 * GET /api/v1/docusign/status
 * Check DocuSign authentication status
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authenticated = docusignService.isAuthenticated();
    res.json({ authenticated });
  } catch (error) {
    docusignLogger.error('DocuSign status check error', { 
      userId: req.user?.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ authenticated: false });
  }
});

/**
 * POST /api/v1/docusign/envelopes/form205
 * Create Form 205 envelope for Texas LLC formation
 */
router.post('/envelopes/form205', validateZodSchema(form205Schema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    docusignLogger.info('Form 205 envelope creation requested', { 
      userId: req.user?.id,
      companyName: req.body.companyName 
    });
    
    const result = await docusignService.createForm205Envelope(req.body);
    
    if (result.success) {
      docusignLogger.info('Form 205 envelope created successfully', { 
        userId: req.user?.id,
        envelopeId: result.envelopeId 
      });
      res.json(result);
    } else {
      docusignLogger.error('Form 205 envelope creation failed', { 
        userId: req.user?.id, 
        error: result.error 
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('Form 205 envelope creation error', { 
      userId: req.user?.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during envelope creation'
    });
  }
});

/**
 * POST /api/v1/docusign/envelopes/operating-agreement
 * Create Operating Agreement envelope
 */
router.post('/envelopes/operating-agreement', validateZodSchema(operatingAgreementSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    docusignLogger.info('Operating Agreement envelope creation requested', { 
      userId: req.user?.id,
      companyName: req.body.companyName 
    });
    
    const result = await docusignService.createOperatingAgreementEnvelope(req.body);
    
    if (result.success) {
      docusignLogger.info('Operating Agreement envelope created successfully', { 
        userId: req.user?.id,
        envelopeId: result.envelopeId 
      });
      res.json(result);
    } else {
      docusignLogger.error('Operating Agreement envelope creation failed', { 
        userId: req.user?.id, 
        error: result.error 
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('Operating Agreement envelope creation error', { 
      userId: req.user?.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during envelope creation'
    });
  }
});

/**
 * POST /api/v1/docusign/envelopes/ein-application
 * Create EIN Application envelope
 */
router.post('/envelopes/ein-application', validateZodSchema(einApplicationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    docusignLogger.info('EIN Application envelope creation requested', { 
      userId: req.user?.id,
      companyName: req.body.companyName 
    });
    
    const result = await docusignService.createEINApplicationEnvelope(req.body);
    
    if (result.success) {
      docusignLogger.info('EIN Application envelope created successfully', { 
        userId: req.user?.id,
        envelopeId: result.envelopeId 
      });
      res.json(result);
    } else {
      docusignLogger.error('EIN Application envelope creation failed', { 
        userId: req.user?.id, 
        error: result.error 
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('EIN Application envelope creation error', { 
      userId: req.user?.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during envelope creation'
    });
  }
});

/**
 * POST /api/v1/docusign/envelopes/:envelopeId/signing-view
 * Create embedded signing view URL
 */
router.post('/envelopes/:envelopeId/signing-view', validateZodSchema(embeddedSigningSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { envelopeId } = req.params;

    docusignLogger.info('Embedded signing view requested', {
      userId: req.user?.id,
      envelopeId,
      recipientEmail: req.body.email
    });

    const result = await docusignService.createEmbeddedSigningView(envelopeId, req.body);

    if (result.success) {
      docusignLogger.info('Embedded signing view created successfully', {
        userId: req.user?.id,
        envelopeId
      });
      res.json(result);
    } else {
      docusignLogger.error('Embedded signing view creation failed', {
        userId: req.user?.id,
        envelopeId,
        error: result.error
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('Embedded signing view creation error', {
      userId: req.user?.id,
      envelopeId: req.params.envelopeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during signing view creation'
    });
  }
});

/**
 * GET /api/v1/docusign/envelopes/:envelopeId/status
 * Get envelope status
 */
router.get('/envelopes/:envelopeId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { envelopeId } = req.params;

    const result = await docusignService.getEnvelopeStatus(envelopeId);
    res.json(result);
  } catch (error) {
    docusignLogger.error('Envelope status retrieval error', {
      userId: req.user?.id,
      envelopeId: req.params.envelopeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Internal server error during status retrieval'
    });
  }
});

/**
 * GET /api/v1/docusign/envelopes/:envelopeId/recipients
 * Get recipient status for envelope
 */
router.get('/envelopes/:envelopeId/recipients', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { envelopeId } = req.params;

    const result = await docusignService.getRecipientStatus(envelopeId);
    res.json(result);
  } catch (error) {
    docusignLogger.error('Recipient status retrieval error', {
      userId: req.user?.id,
      envelopeId: req.params.envelopeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Internal server error during recipient status retrieval'
    });
  }
});

/**
 * GET /api/v1/docusign/templates
 * Get available document templates
 */
router.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await docusignService.getAvailableTemplates();
    res.json(result);
  } catch (error) {
    docusignLogger.error('Template retrieval error', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Internal server error during template retrieval'
    });
  }
});

/**
 * POST /api/v1/docusign/templates/:templateId/envelope
 * Create envelope from template
 */
router.post('/templates/:templateId/envelope', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;

    docusignLogger.info('Template envelope creation requested', {
      userId: req.user?.id,
      templateId
    });

    const result = await docusignService.createEnvelopeFromTemplate(templateId, req.body);

    if (result.success) {
      docusignLogger.info('Template envelope created successfully', {
        userId: req.user?.id,
        templateId,
        envelopeId: result.envelopeId
      });
      res.json(result);
    } else {
      docusignLogger.error('Template envelope creation failed', {
        userId: req.user?.id,
        templateId,
        error: result.error
      });
      res.status(400).json(result);
    }
  } catch (error) {
    docusignLogger.error('Template envelope creation error', {
      userId: req.user?.id,
      templateId: req.params.templateId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error during template envelope creation'
    });
  }
});

export default router;
