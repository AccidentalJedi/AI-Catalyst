import { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '@middleware/errorHandler';
import { AuthenticatedRequest, APIResponse } from '../types/index';
import { uploadDocument, getUserDocuments, getDocumentById, DocumentType } from '@services/documentService';
import { analyzeDocument } from '@services/documentAnalysisService';
import { dbLogger } from '@utils/logger';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});

/**
 * Upload a document
 */
export const uploadDocumentHandler = [
  upload.single('document'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
    
    try {
      const { documentType, retentionPolicy } = req.body;
      
      // Validate document type if provided
      if (documentType && !Object.values(DocumentType).includes(documentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document type',
          requestId: req.headers['x-request-id']
        } as APIResponse);
      }
      
      // Upload document
      const document = await uploadDocument(
        req.user.id,
        {
          originalFileName: req.file.originalname,
          fileBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          documentType: documentType as DocumentType,
          retentionPolicy: retentionPolicy || 'standard'
        },
        req.ip,
        req.get('User-Agent')
      );
      
      res.status(201).json({
        success: true,
        data: {
          document,
          message: 'Document uploaded successfully. Analysis will begin shortly.'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id']
      } as APIResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Document upload failed';
      
      dbLogger.error('Document upload failed:', {
        error: errorMessage,
        userId: req.user.id,
        fileName: req.file?.originalname,
        requestId: req.headers['x-request-id']
      });
      
      res.status(400).json({
        success: false,
        error: errorMessage,
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
  })
];

/**
 * Get all documents for the current user
 */
export const getDocuments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    const documents = await getUserDocuments(req.user.id);
    
    res.json({
      success: true,
      data: { documents },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve documents';
    
    dbLogger.error('Failed to get user documents:', {
      error: errorMessage,
      userId: req.user.id,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Get a specific document by ID
 */
export const getDocument = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  const { documentId } = req.params;
  
  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    const document = await getDocumentById(documentId, req.user.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
    
    res.json({
      success: true,
      data: { document },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve document';
    
    dbLogger.error('Failed to get document:', {
      error: errorMessage,
      userId: req.user.id,
      documentId,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Trigger document analysis manually
 */
export const analyzeDocumentHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  const { documentId } = req.params;
  
  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // Get document details
    const document = await getDocumentById(documentId, req.user.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        requestId: req.headers['x-request-id']
      } as APIResponse);
    }
    
    // Trigger analysis
    const analysisResults = await analyzeDocument(
      documentId,
      req.user.id,
      document.filePath,
      document.mimeType
    );
    
    res.json({
      success: true,
      data: {
        message: 'Document analysis completed',
        analysisResults
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Document analysis failed';
    
    dbLogger.error('Document analysis failed:', {
      error: errorMessage,
      userId: req.user.id,
      documentId,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Get document analysis results
 */
export const getAnalysisResults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  const { documentId } = req.params;
  
  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // TODO: Implement getDocumentAnalysisResults function
    // This would retrieve all analysis results and data points for a document
    
    res.json({
      success: true,
      data: {
        message: 'Analysis results retrieval not yet implemented',
        documentId
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve analysis results';
    
    dbLogger.error('Failed to get analysis results:', {
      error: errorMessage,
      userId: req.user.id,
      documentId,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});

/**
 * Delete a document
 */
export const deleteDocument = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  const { documentId } = req.params;
  
  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required',
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
  
  try {
    // TODO: Implement document deletion
    // This would mark the document as deleted and schedule physical file deletion
    
    res.json({
      success: true,
      data: {
        message: 'Document deletion not yet implemented',
        documentId
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id']
    } as APIResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
    
    dbLogger.error('Failed to delete document:', {
      error: errorMessage,
      userId: req.user.id,
      documentId,
      requestId: req.headers['x-request-id']
    });
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      requestId: req.headers['x-request-id']
    } as APIResponse);
  }
});



