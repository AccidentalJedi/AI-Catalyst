-- AI Catalyst PostgreSQL Initial Schema Migration
-- Converted from SQLite schema version 5
-- Migration: 001_initial_schema.sql

-- Enable UUID extension for primary key generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN DEFAULT true,
  "lastLoginAt" TIMESTAMP,
  "emailVerified" BOOLEAN DEFAULT false,
  "emailVerificationToken" VARCHAR(255),
  "passwordResetToken" VARCHAR(255),
  "passwordResetExpires" TIMESTAMP
);

-- Addresses table (reusable for different address types)
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  "zipCode" VARCHAR(10) NOT NULL,
  county VARCHAR(100) NOT NULL,
  country VARCHAR(2) DEFAULT 'US',
  type VARCHAR(20) NOT NULL CHECK (type IN ('residential', 'business', 'mailing')),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies/LLCs table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "legalName" VARCHAR(255) NOT NULL,
  "dbaName" VARCHAR(255),
  ein VARCHAR(20),
  "formationState" VARCHAR(50) NOT NULL,
  "formationDate" DATE,
  "businessType" VARCHAR(20) NOT NULL CHECK ("businessType" IN ('LLC', 'Corporation', 'Partnership')),
  "businessAddressId" UUID NOT NULL,
  "mailingAddressId" UUID,
  status VARCHAR(20) DEFAULT 'forming' CHECK (status IN ('forming', 'active', 'inactive', 'dissolved')),
  "sosFileNumber" VARCHAR(50),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("businessAddressId") REFERENCES addresses(id),
  FOREIGN KEY ("mailingAddressId") REFERENCES addresses(id)
);

-- Registered agents table
CREATE TABLE IF NOT EXISTS registered_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  "addressId" UUID NOT NULL,
  "isIndividual" BOOLEAN NOT NULL,
  "acceptanceDate" DATE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY ("addressId") REFERENCES addresses(id)
);

-- FinCEN BOI Compliance table (2025 Critical)
CREATE TABLE IF NOT EXISTS boi_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "filingStatus" VARCHAR(20) DEFAULT 'not_started' CHECK ("filingStatus" IN ('not_started', 'in_progress', 'submitted', 'approved', 'rejected')),
  "submissionDate" TIMESTAMP,
  "confirmationNumber" VARCHAR(100),
  deadline DATE NOT NULL,
  "remindersSent" INTEGER DEFAULT 0,
  "lastReminderDate" TIMESTAMP,
  "exemptionClaimed" VARCHAR(50) CHECK ("exemptionClaimed" IN (
    'large_operating_company', 'subsidiary', 'inactive_entity', 'public_company',
    'governmental_authority', 'bank', 'credit_union', 'depository_institution_holding_company',
    'money_services_business', 'broker_dealer', 'securities_exchange_act_company',
    'investment_company', 'investment_adviser', 'venture_capital_fund_adviser',
    'insurance_company', 'state_licensed_insurance_producer', 'commodity_exchange_act_entity',
    'accounting_firm', 'public_utility', 'financial_market_utility',
    'pooled_investment_vehicle', 'tax_exempt_entity'
  )),
  "exemptionReason" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
);

-- Beneficial owners table (FinCEN BOI requirement)
CREATE TABLE IF NOT EXISTS beneficial_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  "dateOfBirth" DATE NOT NULL,
  "addressId" UUID NOT NULL,
  "ownershipPercentage" NUMERIC(5,2),
  "controlType" VARCHAR(20) NOT NULL CHECK ("controlType" IN ('ownership', 'control', 'both')),
  "isExempt" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY ("addressId") REFERENCES addresses(id)
);

-- Identification documents table (for beneficial owners)
CREATE TABLE IF NOT EXISTS identification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "beneficialOwnerId" UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('passport', 'drivers_license', 'state_id')),
  number VARCHAR(50) NOT NULL,
  "issuingState" VARCHAR(50),
  "issuingCountry" VARCHAR(2) NOT NULL,
  "expirationDate" DATE,
  "imageUrl" VARCHAR(500),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("beneficialOwnerId") REFERENCES beneficial_owners(id) ON DELETE CASCADE
);

-- Document templates table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('legal', 'business', 'marketing', 'compliance')),
  template TEXT NOT NULL,
  variables TEXT NOT NULL, -- JSON string of template variables
  "requiredData" TEXT NOT NULL, -- JSON string of required data fields
  version INTEGER DEFAULT 1,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "companyId" UUID,
  "templateId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('legal', 'business', 'marketing', 'compliance')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'signed', 'filed', 'archived')),
  content TEXT,
  "filePath" VARCHAR(500),
  "fileSize" INTEGER,
  "mimeType" VARCHAR(100),
  version INTEGER DEFAULT 1,
  "docusignEnvelopeId" VARCHAR(100),
  "signedAt" TIMESTAMP,
  "filedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY ("templateId") REFERENCES document_templates(id)
);

-- Wizard progress table
CREATE TABLE IF NOT EXISTS wizard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "currentPhase" VARCHAR(50) NOT NULL,
  "currentStep" VARCHAR(50) NOT NULL,
  "completedSteps" TEXT NOT NULL, -- JSON array of completed step IDs
  "overallProgress" INTEGER DEFAULT 0,
  "estimatedTimeRemaining" INTEGER DEFAULT 0,
  "lastUpdated" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Business formation workflow table
CREATE TABLE IF NOT EXISTS business_formation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "companyId" UUID,
  "workflowType" VARCHAR(30) NOT NULL CHECK ("workflowType" IN ('llc_formation', 'corporation_formation', 'partnership_formation')),
  "currentStep" VARCHAR(50) NOT NULL,
  "stepData" TEXT, -- JSON object containing step-specific data
  "completedSteps" TEXT NOT NULL, -- JSON array of completed step IDs
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed', 'cancelled')),
  "formData" TEXT, -- JSON object containing all form data
  "generatedDocuments" TEXT, -- JSON array of generated document IDs
  "submissionData" TEXT, -- JSON object containing submission details
  "errorLog" TEXT, -- JSON array of errors encountered
  "estimatedCompletion" DATE,
  "actualCompletion" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL
);

-- Generated documents table
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflowId" UUID NOT NULL,
  "documentType" VARCHAR(30) NOT NULL CHECK ("documentType" IN ('form_205', 'operating_agreement', 'ein_application')),
  filename VARCHAR(255) NOT NULL,
  "filePath" VARCHAR(500) NOT NULL,
  "generatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workflowId") REFERENCES business_formation_workflows(id) ON DELETE CASCADE
);

-- Compliance checkpoints table
CREATE TABLE IF NOT EXISTS compliance_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  "isRequired" BOOLEAN DEFAULT true,
  "isCompleted" BOOLEAN DEFAULT false,
  deadline DATE,
  "completedAt" TIMESTAMP,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- User sessions table for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(255) NOT NULL,
  "refreshTokenHash" VARCHAR(255),
  "deviceInfo" TEXT, -- JSON string with device/browser info
  "ipAddress" VARCHAR(45) NOT NULL,
  "userAgent" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "expiresAt" TIMESTAMP NOT NULL,
  "refreshExpiresAt" TIMESTAMP,
  "lastActivityAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP,
  "revokedReason" VARCHAR(255),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- User roles table for RBAC
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'veteran', 'admin', 'support')),
  "assignedBy" UUID,
  "assignedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "isActive" BOOLEAN DEFAULT true,
  metadata TEXT, -- JSON string for role-specific data
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("assignedBy") REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE("userId", role)
);

-- Enhanced veteran verification table with comprehensive profile data
CREATE TABLE IF NOT EXISTS veteran_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "verificationStatus" VARCHAR(20) DEFAULT 'pending' CHECK ("verificationStatus" IN ('pending', 'verified', 'rejected', 'expired')),
  "verificationMethod" VARCHAR(20) CHECK ("verificationMethod" IN ('dd214', 'va_card', 'manual_review')),
  "documentPath" VARCHAR(500),
  "verifiedBy" UUID,
  "verifiedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  notes TEXT,
  -- Enhanced military service data
  "branchOfService" VARCHAR(20) CHECK ("branchOfService" IN ('army', 'navy', 'air_force', 'marines', 'coast_guard', 'space_force')),
  "dischargeType" VARCHAR(30) CHECK ("dischargeType" IN ('honorable', 'general_honorable', 'other_than_honorable', 'bad_conduct', 'dishonorable')),
  "serviceEra" VARCHAR(20) CHECK ("serviceEra" IN ('wwii', 'korea', 'vietnam', 'gulf_war', 'post_911', 'peacetime')),
  "homeOfRecord" VARCHAR(100), -- State where veteran entered service
  -- Enhanced disability information
  "vaDisabilityRating" INTEGER CHECK ("vaDisabilityRating" BETWEEN 0 AND 100),
  "isPermanentAndTotal" BOOLEAN DEFAULT false,
  "isIndividuallyUnemployable" BOOLEAN DEFAULT false,
  "disabilityConditions" TEXT, -- JSON array of conditions
  -- Geographic data
  county VARCHAR(100) NOT NULL,
  "homeOfRecordState" VARCHAR(50),
  -- Family information
  "maritalStatus" VARCHAR(20) CHECK ("maritalStatus" IN ('single', 'married', 'divorced', 'widowed', 'separated')),
  "dependentsInfo" TEXT, -- JSON array of dependent objects
  "spouseInfo" TEXT, -- JSON object with spouse details
  -- Financial information
  "annualHouseholdIncome" INTEGER,
  "isHomelessOrAtRisk" BOOLEAN DEFAULT false,
  "employmentStatus" VARCHAR(20) CHECK ("employmentStatus" IN ('employed', 'unemployed', 'disabled', 'retired', 'student')),
  -- Immediate needs assessment
  "immediateNeeds" TEXT, -- JSON array of current needs
  -- Document availability tracking
  "availableDocuments" TEXT, -- JSON object tracking document availability
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE SET NULL
);

-- Audit logs table for comprehensive tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID,
  "sessionId" UUID,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  "resourceId" UUID,
  "oldValues" TEXT, -- JSON string of previous values
  "newValues" TEXT, -- JSON string of new values
  "ipAddress" VARCHAR(45),
  "userAgent" TEXT,
  success BOOLEAN NOT NULL,
  "errorMessage" TEXT,
  metadata TEXT, -- JSON string for additional context
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

-- Data encryption keys table
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keyName" VARCHAR(100) UNIQUE NOT NULL,
  "keyVersion" INTEGER NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  algorithm VARCHAR(50) NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "emailNotifications" BOOLEAN DEFAULT true,
  "smsNotifications" BOOLEAN DEFAULT false,
  "pushNotifications" BOOLEAN DEFAULT true,
  "complianceReminders" BOOLEAN DEFAULT true,
  "marketingEmails" BOOLEAN DEFAULT false,
  "securityAlerts" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Uploaded documents table
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "originalFileName" VARCHAR(255) NOT NULL,
  "storedFileName" VARCHAR(255) NOT NULL,
  "filePath" VARCHAR(500) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "documentType" VARCHAR(30) CHECK ("documentType" IN (
    'military_dd214', 'military_service_record', 'va_disability_letter', 'va_rating_decision',
    'tax_return', 'income_statement', 'bank_statement', 'financial_statement',
    'business_license', 'certification', 'court_order', 'legal_document',
    'personal_narrative', 'autobiography', 'personal_statement', 'case_history',
    'medical_record', 'disability_documentation', 'medical_report',
    'educational_transcript', 'educational_certificate', 'training_certificate',
    'other'
  )),
  "processingStatus" VARCHAR(20) DEFAULT 'uploaded' CHECK ("processingStatus" IN (
    'uploaded', 'processing', 'analyzed', 'failed', 'deleted'
  )),
  "isEncrypted" BOOLEAN DEFAULT true,
  "retentionPolicy" VARCHAR(20) DEFAULT 'standard', -- standard, extended, permanent
  "scheduledDeletion" TIMESTAMP,
  "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP,
  "lastAccessedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Document analysis results table
CREATE TABLE IF NOT EXISTS document_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "analysisType" VARCHAR(30) NOT NULL CHECK ("analysisType" IN (
    'text_extraction', 'ocr_processing', 'data_extraction', 'qualification_analysis'
  )),
  "analysisStatus" VARCHAR(20) DEFAULT 'pending' CHECK ("analysisStatus" IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  "extractedText" TEXT,
  "structuredData" TEXT, -- JSON string of extracted data points
  "confidenceScore" NUMERIC(3,2) DEFAULT 0.0,
  "processingTime" INTEGER, -- milliseconds
  "errorMessage" TEXT,
  "analysisMetadata" TEXT, -- JSON string for additional analysis info
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  FOREIGN KEY ("documentId") REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Document data points table
CREATE TABLE IF NOT EXISTS document_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "analysisId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "dataType" VARCHAR(30) NOT NULL CHECK ("dataType" IN (
    'disability_rating', 'service_dates', 'discharge_status', 'branch_of_service',
    'income_amount', 'income_year', 'employment_status', 'business_ownership',
    'address', 'county', 'state', 'zip_code',
    'education_level', 'certifications', 'training_completed',
    'medical_condition', 'treatment_dates', 'provider_info',
    'family_status', 'dependents_count', 'spouse_info',
    'other'
  )),
  "extractedValue" TEXT NOT NULL,
  "normalizedValue" TEXT, -- Standardized format of the value
  "confidenceScore" NUMERIC(3,2) NOT NULL,
  "sourceLocation" TEXT, -- Page/section where data was found
  "verificationStatus" VARCHAR(20) DEFAULT 'unverified' CHECK ("verificationStatus" IN (
    'unverified', 'user_confirmed', 'user_corrected', 'system_verified', 'flagged'
  )),
  "userCorrectedValue" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP,
  FOREIGN KEY ("analysisId") REFERENCES document_analysis_results(id) ON DELETE CASCADE,
  FOREIGN KEY ("documentId") REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Document cross-references table (links to grant opportunities)
CREATE TABLE IF NOT EXISTS document_cross_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "dataPointId" UUID,
  "referenceType" VARCHAR(30) NOT NULL CHECK ("referenceType" IN (
    'grant_eligibility', 'qualification_match', 'requirement_fulfillment', 'verification_source'
  )),
  "referenceEntityType" VARCHAR(30) NOT NULL CHECK ("referenceEntityType" IN (
    'grant_opportunity', 'compliance_checkpoint', 'wizard_step', 'user_profile_field'
  )),
  "referenceEntityId" UUID NOT NULL,
  "matchConfidence" NUMERIC(3,2),
  "matchReason" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("documentId") REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  FOREIGN KEY ("dataPointId") REFERENCES document_data_points(id) ON DELETE SET NULL,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Sync records table for data synchronization
CREATE TABLE IF NOT EXISTS sync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityType" VARCHAR(50) NOT NULL,
  "entityId" UUID NOT NULL,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'sync')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'retrying')),
  "externalSystem" VARCHAR(50) NOT NULL,
  "externalId" VARCHAR(100),
  payload TEXT NOT NULL, -- JSON string
  response TEXT, -- JSON string
  error TEXT,
  "retryCount" INTEGER DEFAULT 0,
  "maxRetries" INTEGER DEFAULT 3,
  "nextRetryAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID,
  "sessionId" UUID NOT NULL,
  "eventType" VARCHAR(50) NOT NULL,
  "eventData" TEXT NOT NULL, -- JSON string
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" VARCHAR(45),
  "userAgent" TEXT,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

-- Enhanced grant opportunities table
CREATE TABLE IF NOT EXISTS grant_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "grantName" VARCHAR(255) NOT NULL,
  "grantingOrganization" VARCHAR(255) NOT NULL,
  "organizationWebsite" VARCHAR(500),
  "grantDescription" TEXT,
  "grantType" VARCHAR(30) CHECK ("grantType" IN ('financial', 'service', 'tax_exemption', 'tuition_waiver', 'debt_forgiveness')),
  "paymentType" VARCHAR(30) CHECK ("paymentType" IN ('direct_to_veteran', 'direct_to_vendor', 'reimbursement')),
  -- Structured eligibility criteria
  "eligibilityCriteria" TEXT, -- JSON object with structured rules
  "targetPopulation" TEXT, -- JSON array: veteran, spouse, dependent, family
  "minDisabilityRating" INTEGER CHECK ("minDisabilityRating" BETWEEN 0 AND 100),
  "maxDisabilityRating" INTEGER CHECK ("maxDisabilityRating" BETWEEN 0 AND 100),
  "residencyRequired" TEXT, -- JSON array of states/counties
  "serviceEraRequired" TEXT, -- JSON array of required service eras
  "incomeRequirements" TEXT, -- JSON object with income limits
  "otherCriteriaText" TEXT, -- Complex criteria for LLM processing
  -- Application process details
  "applicationProcess" TEXT, -- JSON object with process details
  "applicationURL" VARCHAR(500),
  "applicationWindow" VARCHAR(100), -- Rolling, seasonal, or specific dates
  "requiredDocuments" TEXT, -- JSON array of document types
  "actionableSteps" TEXT, -- Human-curated step-by-step guide
  -- Friction scoring components
  "frictionScore" INTEGER CHECK ("frictionScore" BETWEEN 1 AND 10),
  "documentationBurden" INTEGER CHECK ("documentationBurden" BETWEEN 1 AND 3),
  "processSteps" INTEGER CHECK ("processSteps" BETWEEN 1 AND 3),
  "thirdPartyDependency" INTEGER CHECK ("thirdPartyDependency" BETWEEN 1 AND 3),
  "ambiguityGatekeeping" INTEGER CHECK ("ambiguityGatekeeping" BETWEEN 1 AND 3),
  "submissionMode" INTEGER CHECK ("submissionMode" BETWEEN 1 AND 3),
  -- Contact and metadata
  "pointOfContact" TEXT, -- JSON object with contact info
  "maxGrantAmount" NUMERIC(10,2),
  "averageProcessingTime" INTEGER, -- Days
  "successRate" NUMERIC(3,2), -- Percentage as decimal
  "lastUpdated" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant matching results table
CREATE TABLE IF NOT EXISTS grant_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "grantId" UUID NOT NULL,
  "matchScore" NUMERIC(3,2) NOT NULL,
  "eligibilityStatus" VARCHAR(20) CHECK ("eligibilityStatus" IN ('eligible', 'ineligible', 'maybe', 'needs_review')),
  "matchReason" TEXT,
  "ruleBasedMatch" BOOLEAN DEFAULT false,
  "llmClassification" TEXT, -- eligible/ineligible/maybe from LLM
  "llmConfidence" NUMERIC(3,2),
  "frictionAdjustedScore" NUMERIC(3,2), -- Match score adjusted for friction
  "recommendationPriority" INTEGER,
  "lastChecked" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "userFeedback" TEXT, -- User's feedback on match quality
  "applicationStarted" BOOLEAN DEFAULT false,
  "applicationCompleted" BOOLEAN DEFAULT false,
  "grantAwarded" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("grantId") REFERENCES grant_opportunities(id) ON DELETE CASCADE
);

-- Schema version table for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  "appliedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial schema version
INSERT INTO schema_version (version) VALUES (1) ON CONFLICT (version) DO NOTHING;
