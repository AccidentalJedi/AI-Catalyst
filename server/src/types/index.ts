// Backend-specific types for AI Catalyst Launch Wizard
// Extends frontend types with server-side specific interfaces

import { Request } from 'express';

// Re-export business formation types
export * from './businessTypes';

// Re-export utility functions
export { dbUtils, transaction } from '@utils/database';
export { encryptSensitiveFields, decryptSensitiveFields } from '@utils/encryption';
export { logSuccess, logFailure, logDataChange, AuditAction, AuditResource } from '@utils/audit';
export { dbLogger, auditLogger, authLogger, fileLogger, boiLogger } from '@utils/logger';

// Re-export middleware functions
export { authenticateToken } from '@middleware/auth';

// Re-export service functions
export { findMatchingGrants, storeGrantMatches, getUserGrantMatches, updateGrantMatchFeedback } from '@services/grantMatchingService';
export { BusinessFormationService } from '@services/businessFormationService';
export { ValidationService } from '@services/validationService';
export { DocumentGenerationService } from '@services/documentGenerationService';

// Re-export controller functions
export { formBusiness } from '@controllers/businessController';

// Re-export service functions for document pipeline
export { analyzeDocument } from '@services/documentAnalysisService';
export { updateWizardProgress } from '@services/wizardService';
export { updateUser } from '@services/userService';

// Re-export validation schemas
export { businessFormationPayloadSchema } from '@services/businessSchemas';

// Database entity types
export interface UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLoginAt?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

// User session entity
export interface UserSessionEntity {
  id: string;
  userId: string;
  tokenHash: string;
  refreshTokenHash?: string;
  deviceInfo?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  isActive: boolean;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  lastActivityAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

// User role entity
export interface UserRoleEntity {
  id: string;
  userId: string;
  role: 'user' | 'veteran' | 'admin' | 'support';
  assignedBy?: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

// Veteran verification entity
export interface VeteranVerificationEntity {
  id: string;
  userId: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  verificationMethod?: 'dd214' | 'va_card' | 'manual_review';
  documentPath?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  expiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Audit log entity
export interface AuditLogEntity {
  id: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Notification preferences entity
export interface NotificationPreferencesEntity {
  id: string;
  userId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  complianceReminders: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Document entities
export interface UploadedDocumentEntity {
  id: string;
  userId: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  processingStatus: string;
  isEncrypted: boolean;
  retentionPolicy: string;
  scheduledDeletion?: Date;
  uploadedAt: Date;
  processedAt?: Date;
  lastAccessedAt: Date;
}

export interface DocumentAnalysisResultEntity {
  id: string;
  documentId: string;
  userId: string;
  analysisType: string;
  analysisStatus: string;
  extractedText?: string;
  structuredData?: Record<string, any>;
  confidenceScore: number;
  processingTime?: number;
  errorMessage?: string;
  analysisMetadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

export interface DocumentDataPointEntity {
  id: string;
  analysisId: string;
  documentId: string;
  userId: string;
  dataType: string;
  extractedValue: string;
  normalizedValue?: string;
  confidenceScore: number;
  sourceLocation?: string;
  verificationStatus: string;
  userCorrectedValue?: string;
  notes?: string;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface DocumentCrossReferenceEntity {
  id: string;
  documentId: string;
  userId: string;
  dataPointId?: string;
  referenceType: string;
  referenceEntityType: string;
  referenceEntityId: string;
  matchConfidence?: number;
  matchReason?: string;
  isActive: boolean;
  createdAt: Date;
}

// FinCEN BOI Compliance Types (2025 Requirements)
export interface BeneficialOwnerEntity {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  address: AddressEntity;
  identificationDocument: IdentificationDocument;
  ownershipPercentage?: number;
  controlType: 'ownership' | 'control' | 'both';
  isExempt: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentificationDocument {
  type: 'passport' | 'drivers_license' | 'state_id';
  number: string;
  issuingState?: string;
  issuingCountry: string;
  expirationDate?: Date;
  imageUrl?: string;
}

export interface AddressEntity {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  country: string;
  type: 'residential' | 'business';
}

// BOI Compliance Tracking
export interface BOIComplianceEntity {
  id: string;
  userId: string;
  companyId: string;
  filingStatus: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  submissionDate?: Date;
  confirmationNumber?: string;
  deadline: Date;
  remindersSent: number;
  lastReminderDate?: Date;
  exemptionClaimed?: string;
  exemptionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Legacy Company/LLC Entity (kept for backward compatibility)
export interface LegacyCompanyEntity {
  id: string;
  userId: string;
  legalName: string;
  dbaName?: string;
  ein?: string;
  formationState: string;
  formationDate?: Date;
  businessType: 'LLC' | 'Corporation' | 'Partnership';
  registeredAgent: LegacyRegisteredAgentEntity;
  businessAddress: AddressEntity;
  mailingAddress?: AddressEntity;
  status: 'forming' | 'active' | 'inactive' | 'dissolved';
  sosFileNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegacyRegisteredAgentEntity {
  id: string;
  name: string;
  address: AddressEntity;
  isIndividual: boolean;
  acceptanceDate?: Date;
}

// Document Management
export interface DocumentEntity {
  id: string;
  userId: string;
  companyId?: string;
  templateId: string;
  name: string;
  type: 'legal' | 'business' | 'marketing' | 'compliance';
  status: 'draft' | 'generated' | 'signed' | 'filed' | 'archived';
  content?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  version: number;
  docusignEnvelopeId?: string;
  signedAt?: Date;
  filedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Progress Tracking
export interface WizardProgressEntity {
  id: string;
  userId: string;
  currentPhase: string;
  currentStep: string;
  completedSteps: string[];
  overallProgress: number;
  estimatedTimeRemaining: number;
  complianceCheckpoints: ComplianceCheckpoint[];
  lastUpdated: Date;
  createdAt: Date;
}

export interface ComplianceCheckpoint {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  isCompleted: boolean;
  deadline?: Date;
  completedAt?: Date;
  notes?: string;
}

// Analytics
export interface AnalyticsEvent {
  id: string;
  userId?: string;
  sessionId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// API Request/Response types
export interface AuthenticatedRequest extends Request {
  user?: UserEntity;
  sessionId?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  details?: any;
  stack?: string;
  timestamp: Date;
  requestId: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Configuration types
export interface DatabaseConfig {
  filename: string;
  options: {
    verbose?: ((message?: unknown, ...additionalArgs: unknown[]) => void) | undefined;
    fileMustExist?: boolean;
    timeout?: number;
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    uploadDir: string;
    maxFileSize: number;
    allowedTypes: string[];
  };
}

// DocuSign Integration Types
export interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  basePath: string;
  oAuthBasePath: string;
}

// Veteran Profile for grant matching
export interface VeteranProfile {
  userId: string;
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
  availableDocuments: string[];
}

export interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
  documentsUri: string;
  recipientsUri: string;
  attachmentsUri: string;
  envelopeUri: string;
  emailSubject: string;
  emailBlurb: string;
  envelopeIdStamping: string;
  authoritative: string;
  voidedDateTime?: string;
  voidedReason?: string;
}

// External API Response Types
export interface TexasSosApiResponse {
  success: boolean;
  data?: {
    entityName: string;
    entityType: string;
    status: string;
    fileNumber: string;
    formationDate: string;
    registeredAgent: {
      name: string;
      address: string;
    };
  };
  error?: string;
}

// Validation Schemas (for Joi)
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}


