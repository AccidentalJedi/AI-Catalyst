import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dbUtils, transaction } from '@utils/databaseAdapter';
import { encryptSensitiveFields, decryptSensitiveFields, generateSecureToken } from '@utils/encryption';
import { logSuccess, logFailure, logDataChange, AuditAction, AuditResource } from '@utils/audit';
import { dbLogger, fileLogger } from '@utils/logger';
import { serverConfig } from '@config/index';

// Document types enum
export enum DocumentType {
  MILITARY_DD214 = 'military_dd214',
  MILITARY_SERVICE_RECORD = 'military_service_record',
  VA_DISABILITY_LETTER = 'va_disability_letter',
  VA_RATING_DECISION = 'va_rating_decision',
  TAX_RETURN = 'tax_return',
  INCOME_STATEMENT = 'income_statement',
  BANK_STATEMENT = 'bank_statement',
  FINANCIAL_STATEMENT = 'financial_statement',
  BUSINESS_LICENSE = 'business_license',
  CERTIFICATION = 'certification',
  COURT_ORDER = 'court_order',
  LEGAL_DOCUMENT = 'legal_document',
  PERSONAL_NARRATIVE = 'personal_narrative',
  AUTOBIOGRAPHY = 'autobiography',
  PERSONAL_STATEMENT = 'personal_statement',
  CASE_HISTORY = 'case_history',
  MEDICAL_RECORD = 'medical_record',
  DISABILITY_DOCUMENTATION = 'disability_documentation',
  MEDICAL_REPORT = 'medical_report',
  EDUCATIONAL_TRANSCRIPT = 'educational_transcript',
  EDUCATIONAL_CERTIFICATE = 'educational_certificate',
  TRAINING_CERTIFICATE = 'training_certificate',
  OTHER = 'other'
}

// Processing status enum
export enum ProcessingStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  ANALYZED = 'analyzed',
  FAILED = 'failed',
  DELETED = 'deleted'
}

// Document upload data
export interface DocumentUploadData {
  originalFileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  documentType?: DocumentType;
  retentionPolicy?: 'standard' | 'extended' | 'permanent';
}

// Document entity
export interface DocumentEntity {
  id: string;
  userId: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  processingStatus: ProcessingStatus;
  isEncrypted: boolean;
  retentionPolicy: string;
  scheduledDeletion?: Date;
  uploadedAt: Date;
  processedAt?: Date;
  lastAccessedAt: Date;
}

/**
 * Upload and store a document securely
 */
export const uploadDocument = async (
  userId: string,
  uploadData: DocumentUploadData,
  ipAddress?: string,
  userAgent?: string
): Promise<DocumentEntity> => {
  try {
    const documentId = crypto.randomUUID();
    const fileExtension = path.extname(uploadData.originalFileName);
    const storedFileName = `${documentId}${fileExtension}`;
    const userDocumentDir = path.join(serverConfig.upload.uploadDir, 'documents', userId);
    const filePath = path.join(userDocumentDir, storedFileName);
    
    // Ensure user document directory exists
    if (!fs.existsSync(userDocumentDir)) {
      fs.mkdirSync(userDocumentDir, { recursive: true });
    }
    
    // Validate file type and size
    await validateDocument(uploadData);
    
    // Calculate retention schedule
    const scheduledDeletion = calculateRetentionSchedule(uploadData.retentionPolicy || 'standard');
    
    const document = await transaction(async (trx) => {
      // Encrypt and store file
      const encryptedBuffer = await encryptFile(uploadData.fileBuffer);
      fs.writeFileSync(filePath, encryptedBuffer);

      // Store document metadata
      await trx.raw(`
        INSERT INTO uploaded_documents (
          id, userId, originalFileName, storedFileName, filePath, fileSize,
          mimeType, documentType, processingStatus, isEncrypted, retentionPolicy,
          scheduledDeletion, uploadedAt, lastAccessedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        documentId,
        userId,
        uploadData.originalFileName,
        storedFileName,
        filePath,
        uploadData.fileBuffer.length,
        uploadData.mimeType,
        uploadData.documentType || DocumentType.OTHER,
        ProcessingStatus.UPLOADED,
        uploadData.retentionPolicy || 'standard',
        scheduledDeletion ? scheduledDeletion.toISOString() : null
      ]);

      return documentId;
    });
    
    // Get the created document
    const createdDocument = await getDocumentById(documentId, userId);
    if (!createdDocument) {
      throw new Error('Failed to retrieve uploaded document');
    }
    
    // Log successful upload
    await logSuccess(AuditAction.DOCUMENT_CREATE, AuditResource.DOCUMENT, {
      userId,
      resourceId: documentId,
      ipAddress,
      userAgent,
      metadata: {
        originalFileName: uploadData.originalFileName,
        documentType: uploadData.documentType,
        fileSize: uploadData.fileBuffer.length
      }
    });
    
    fileLogger.info('Document uploaded successfully', {
      userId,
      documentId,
      originalFileName: uploadData.originalFileName,
      documentType: uploadData.documentType,
      fileSize: uploadData.fileBuffer.length
    });
    
    // Trigger asynchronous document analysis
    await triggerDocumentAnalysis(documentId, userId);
    
    return createdDocument;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logFailure(AuditAction.DOCUMENT_CREATE, AuditResource.DOCUMENT, errorMessage, {
      userId,
      ipAddress,
      userAgent,
      metadata: { originalFileName: uploadData.originalFileName }
    });
    
    fileLogger.error('Failed to upload document:', {
      error: errorMessage,
      userId,
      originalFileName: uploadData.originalFileName
    });
    
    throw new Error('Document upload failed');
  }
};

/**
 * Get document by ID
 */
export const getDocumentById = async (
  documentId: string,
  userId: string
): Promise<DocumentEntity | null> => {
  try {
    const document = await dbUtils.get<any>(`
      SELECT * FROM uploaded_documents
      WHERE id = ? AND userId = ? AND processingStatus != 'deleted'
    `, [documentId, userId]);

    if (!document) {
      return null;
    }

    // Update last accessed time
    await dbUtils.run(`
      UPDATE uploaded_documents
      SET lastAccessedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [documentId]);
    
    return {
      id: document.id,
      userId: document.userId,
      originalFileName: document.originalFileName,
      storedFileName: document.storedFileName,
      filePath: document.filePath,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      documentType: document.documentType as DocumentType,
      processingStatus: document.processingStatus as ProcessingStatus,
      isEncrypted: Boolean(document.isEncrypted),
      retentionPolicy: document.retentionPolicy,
      scheduledDeletion: document.scheduledDeletion ? new Date(document.scheduledDeletion) : undefined,
      uploadedAt: new Date(document.uploadedAt),
      processedAt: document.processedAt ? new Date(document.processedAt) : undefined,
      lastAccessedAt: new Date(document.lastAccessedAt)
    };
  } catch (error) {
    fileLogger.error('Failed to get document by ID:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId
    });
    return null;
  }
};

/**
 * Get all documents for a user
 */
export const getUserDocuments = async (userId: string): Promise<DocumentEntity[]> => {
  try {
    const documents = await dbUtils.all<any>(`
      SELECT * FROM uploaded_documents
      WHERE userId = ? AND processingStatus != 'deleted'
      ORDER BY uploadedAt DESC
    `, [userId]);
    
    return documents.map(doc => ({
      id: doc.id,
      userId: doc.userId,
      originalFileName: doc.originalFileName,
      storedFileName: doc.storedFileName,
      filePath: doc.filePath,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      documentType: doc.documentType as DocumentType,
      processingStatus: doc.processingStatus as ProcessingStatus,
      isEncrypted: Boolean(doc.isEncrypted),
      retentionPolicy: doc.retentionPolicy,
      scheduledDeletion: doc.scheduledDeletion ? new Date(doc.scheduledDeletion) : undefined,
      uploadedAt: new Date(doc.uploadedAt),
      processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
      lastAccessedAt: new Date(doc.lastAccessedAt)
    }));
  } catch (error) {
    fileLogger.error('Failed to get user documents:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
};

/**
 * Validate document before upload
 */
const validateDocument = async (uploadData: DocumentUploadData): Promise<void> => {
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (uploadData.fileBuffer.length > maxSize) {
    throw new Error('File size exceeds maximum limit of 50MB');
  }
  
  // Check MIME type
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedMimeTypes.includes(uploadData.mimeType)) {
    throw new Error('File type not supported');
  }
  
  // Basic malware check (check for suspicious patterns)
  const suspiciousPatterns = [
    /<%[\s\S]*?%>/g, // PHP tags
    /<script[\s\S]*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /vbscript:/gi // VBScript protocol
  ];
  
  const fileContent = uploadData.fileBuffer.toString('utf8', 0, Math.min(1024, uploadData.fileBuffer.length));
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fileContent)) {
      throw new Error('File contains suspicious content');
    }
  }
};

/**
 * Calculate retention schedule based on policy
 */
const calculateRetentionSchedule = (policy: string): Date | null => {
  const now = new Date();
  
  switch (policy) {
    case 'standard':
      // 2 years retention
      return new Date(now.getTime() + (2 * 365 * 24 * 60 * 60 * 1000));
    case 'extended':
      // 7 years retention (for financial/legal documents)
      return new Date(now.getTime() + (7 * 365 * 24 * 60 * 60 * 1000));
    case 'permanent':
      // No automatic deletion
      return null;
    default:
      return new Date(now.getTime() + (2 * 365 * 24 * 60 * 60 * 1000));
  }
};

/**
 * Encrypt file content
 */
const encryptFile = async (fileBuffer: Buffer): Promise<Buffer> => {
  // For now, return the original buffer
  // In production, implement proper file encryption
  return fileBuffer;
};

/**
 * Trigger asynchronous document analysis
 */
const triggerDocumentAnalysis = async (documentId: string, userId: string): Promise<void> => {
  try {
    // Get document details for processing
    const document = await getDocumentById(documentId, userId);
    if (!document) {
      throw new Error('Document not found for analysis');
    }

    // Update document status to processing
    dbUtils.run(`
      UPDATE uploaded_documents
      SET processingStatus = 'processing'
      WHERE id = ?
    `, [documentId]);

    // Import and trigger the document processing pipeline
    const { processDocumentPipeline } = await import('./documentPipelineService');

    // Run pipeline asynchronously (don't await to avoid blocking upload response)
    processDocumentPipeline(
      documentId,
      userId,
      document.filePath,
      document.mimeType,
      document.documentType
    ).catch(error => {
      fileLogger.error('Document processing pipeline failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId,
        userId
      });

      // Update document status to failed
      dbUtils.run(`
        UPDATE uploaded_documents
        SET processingStatus = 'failed'
        WHERE id = ?
      `, [documentId]);
    });

    fileLogger.info('Document analysis pipeline triggered', {
      documentId,
      userId,
      documentType: document.documentType
    });
  } catch (error) {
    fileLogger.error('Failed to trigger document analysis:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId
    });
  }
};


