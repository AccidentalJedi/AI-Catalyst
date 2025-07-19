import { Router } from 'express';
import { authenticateToken } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import {
  uploadDocumentHandler,
  getDocuments,
  getDocument,
  analyzeDocumentHandler,
  getAnalysisResults,
  deleteDocument
} from '@controllers/documentController';

const router = Router();

// Validation schemas
const uploadDocumentSchema = {
  body: {
    type: 'object',
    properties: {
      documentType: {
        type: 'string',
        enum: [
          'military_dd214', 'military_service_record', 'va_disability_letter', 'va_rating_decision',
          'tax_return', 'income_statement', 'bank_statement', 'financial_statement',
          'business_license', 'certification', 'court_order', 'legal_document',
          'personal_narrative', 'autobiography', 'personal_statement', 'case_history',
          'medical_record', 'disability_documentation', 'medical_report',
          'educational_transcript', 'educational_certificate', 'training_certificate',
          'other'
        ]
      },
      retentionPolicy: {
        type: 'string',
        enum: ['standard', 'extended', 'permanent']
      }
    },
    additionalProperties: false
  }
};

const documentIdSchema = {
  params: {
    type: 'object',
    required: ['documentId'],
    properties: {
      documentId: {
        type: 'string',
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' // UUID format
      }
    },
    additionalProperties: false
  }
};

// All routes require authentication
router.use(authenticateToken);

// Document management routes
router.post('/upload', uploadDocumentHandler);
router.get('/', getDocuments);
router.get('/:documentId', getDocument);
router.delete('/:documentId', deleteDocument);

// Document analysis routes
router.post('/:documentId/analyze', analyzeDocumentHandler);
router.get('/:documentId/analysis', getAnalysisResults);

export default router;


