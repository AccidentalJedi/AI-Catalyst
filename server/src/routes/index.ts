import { Router } from 'express';
import authRoutes from './auth';
import documentRoutes from './documents';
import llmConfigRoutes from './llmConfig';
import grantMatchingRoutes from './grantMatching';
import businessRoutes from './business';
import docusignRoutes from './docusign';

const router = Router();

// API version prefix
const API_VERSION = '/api/v1';

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Catalyst Launch Wizard API is running',
    timestamp: new Date(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount route modules
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/documents`, documentRoutes);
router.use(`${API_VERSION}/llm`, llmConfigRoutes);
router.use(`${API_VERSION}/grants`, grantMatchingRoutes);
router.use(`${API_VERSION}/business`, businessRoutes);
router.use(`${API_VERSION}/docusign`, docusignRoutes);

// API documentation endpoint
router.get(`${API_VERSION}/docs`, (req, res) => {
  res.json({
    success: true,
    message: 'AI Catalyst Launch Wizard API Documentation',
    version: 'v1',
    endpoints: {
      auth: {
        'POST /auth/register': 'Register a new user account',
        'POST /auth/login': 'Login with email and password',
        'POST /auth/refresh': 'Refresh access token',
        'POST /auth/logout': 'Logout and revoke session',
        'GET /auth/profile': 'Get current user profile',
        'GET /auth/verify': 'Verify token validity'
      },
      documents: {
        'POST /documents/upload': 'Upload a document for analysis',
        'GET /documents': 'Get all user documents',
        'GET /documents/:id': 'Get specific document details',
        'POST /documents/:id/analyze': 'Trigger document analysis',
        'GET /documents/:id/analysis': 'Get document analysis results',
        'DELETE /documents/:id': 'Delete a document'
      },
      llm: {
        'GET /llm/health': 'Get LLM provider health status',
        'POST /llm/health/refresh': 'Refresh LLM provider health',
        'GET /llm/config/validate': 'Validate LLM configuration',
        'POST /llm/test/:provider': 'Test specific LLM provider',
        'POST /llm/test/classification': 'Test LLM classification',
        'GET /llm/config/current': 'Get current LLM configuration',
        'GET /llm/stats': 'Get LLM usage statistics'
      },
      grants: {
        'POST /grants/find': 'Find matching grants for veteran profile',
        'GET /grants/matches': 'Get stored grant matches for user',
        'POST /grants/matches/:grantId/feedback': 'Update grant match feedback',
        'GET /grants/stats': 'Get grant matching statistics',
        'GET /grants/:grantId': 'Get detailed grant information',
        'GET /grants/search': 'Search grants by criteria'
      },
      business: {
        'POST /business/form': 'Legacy business formation endpoint (delegates to workflow system)',
        'POST /business/formation': 'Start a new business formation workflow',
        'POST /business/formation/llc': 'Start a new LLC formation workflow',
        'GET /business': 'Get user\'s businesses',
        'GET /business/workflow/:workflowId': 'Get business formation workflow details',
        'PUT /business/workflow/:workflowId/step': 'Update workflow step',
        'POST /business/workflow/:workflowId/complete': 'Complete business formation workflow',
        'POST /business/workflow/:workflowId/cancel': 'Cancel business formation workflow',
        'POST /business/documents/generate': 'Generate business formation document',
        'POST /business/documents/form-205': 'Generate Texas Form 205',
        'POST /business/documents/operating-agreement': 'Generate Operating Agreement',
        'POST /business/documents/ein-application': 'Generate EIN Application',
        'GET /business/documents/:documentId': 'Get generated document'
      },
      docusign: {
        'POST /docusign/authenticate': 'Authenticate with DocuSign using JWT',
        'GET /docusign/status': 'Check DocuSign authentication status',
        'POST /docusign/envelopes/form205': 'Create Form 205 envelope for Texas LLC formation',
        'POST /docusign/envelopes/operating-agreement': 'Create Operating Agreement envelope',
        'POST /docusign/envelopes/ein-application': 'Create EIN Application envelope',
        'POST /docusign/envelopes/:envelopeId/signing-view': 'Create embedded signing view URL',
        'GET /docusign/envelopes/:envelopeId/status': 'Get envelope status',
        'GET /docusign/envelopes/:envelopeId/recipients': 'Get recipient status for envelope',
        'GET /docusign/templates': 'Get available document templates',
        'POST /docusign/templates/:templateId/envelope': 'Create envelope from template'
      },
      health: {
        'GET /health': 'API health check'
      }
    },
    timestamp: new Date()
  });
});

export default router;


