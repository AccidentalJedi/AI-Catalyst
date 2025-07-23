-- AI Catalyst PostgreSQL Indexes Migration
-- Migration: 002_create_indexes.sql
-- Creates performance indexes for all tables

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users("isActive");

-- Company indexes
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies("userId");
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_ein ON companies(ein);

-- Business formation workflow indexes
CREATE INDEX IF NOT EXISTS idx_business_formation_workflows_user ON business_formation_workflows("userId");
CREATE INDEX IF NOT EXISTS idx_business_formation_workflows_company ON business_formation_workflows("companyId");
CREATE INDEX IF NOT EXISTS idx_business_formation_workflows_status ON business_formation_workflows(status);
CREATE INDEX IF NOT EXISTS idx_business_formation_workflows_type ON business_formation_workflows("workflowType");
CREATE INDEX IF NOT EXISTS idx_business_formation_workflows_step ON business_formation_workflows("currentStep");

-- Generated documents indexes
CREATE INDEX IF NOT EXISTS idx_generated_documents_workflow ON generated_documents("workflowId");
CREATE INDEX IF NOT EXISTS idx_generated_documents_type ON generated_documents("documentType");
CREATE INDEX IF NOT EXISTS idx_generated_documents_generated ON generated_documents("generatedAt");

-- BOI compliance indexes
CREATE INDEX IF NOT EXISTS idx_boi_compliance_user ON boi_compliance("userId");
CREATE INDEX IF NOT EXISTS idx_boi_compliance_company ON boi_compliance("companyId");
CREATE INDEX IF NOT EXISTS idx_boi_compliance_status ON boi_compliance("filingStatus");
CREATE INDEX IF NOT EXISTS idx_boi_compliance_deadline ON boi_compliance(deadline);

-- Beneficial owners indexes
CREATE INDEX IF NOT EXISTS idx_beneficial_owners_user ON beneficial_owners("userId");
CREATE INDEX IF NOT EXISTS idx_beneficial_owners_company ON beneficial_owners("companyId");

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents("userId");
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents("companyId");
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions("tokenHash");
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions("isActive");
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions("expiresAt");

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles("userId");
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles("isActive");

-- Enhanced veteran verification indexes
CREATE INDEX IF NOT EXISTS idx_veteran_verification_user ON veteran_verification("userId");
CREATE INDEX IF NOT EXISTS idx_veteran_verification_status ON veteran_verification("verificationStatus");
CREATE INDEX IF NOT EXISTS idx_veteran_verification_county ON veteran_verification(county);
CREATE INDEX IF NOT EXISTS idx_veteran_verification_disability ON veteran_verification("vaDisabilityRating");
CREATE INDEX IF NOT EXISTS idx_veteran_verification_pt ON veteran_verification("isPermanentAndTotal");
CREATE INDEX IF NOT EXISTS idx_veteran_verification_branch ON veteran_verification("branchOfService");
CREATE INDEX IF NOT EXISTS idx_veteran_verification_era ON veteran_verification("serviceEra");

-- Grant opportunities indexes
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_type ON grant_opportunities("grantType");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_payment ON grant_opportunities("paymentType");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_disability ON grant_opportunities("minDisabilityRating");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_friction ON grant_opportunities("frictionScore");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_active ON grant_opportunities("isActive");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_amount ON grant_opportunities("maxGrantAmount");
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_org ON grant_opportunities("grantingOrganization");

-- Grant matches indexes
CREATE INDEX IF NOT EXISTS idx_grant_matches_user ON grant_matches("userId");
CREATE INDEX IF NOT EXISTS idx_grant_matches_grant ON grant_matches("grantId");
CREATE INDEX IF NOT EXISTS idx_grant_matches_score ON grant_matches("matchScore");
CREATE INDEX IF NOT EXISTS idx_grant_matches_eligibility ON grant_matches("eligibilityStatus");
CREATE INDEX IF NOT EXISTS idx_grant_matches_priority ON grant_matches("recommendationPriority");
CREATE INDEX IF NOT EXISTS idx_grant_matches_friction_score ON grant_matches("frictionAdjustedScore");
CREATE INDEX IF NOT EXISTS idx_grant_matches_application ON grant_matches("applicationStarted", "applicationCompleted");

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

-- Encryption keys indexes
CREATE INDEX IF NOT EXISTS idx_encryption_keys_name ON encryption_keys("keyName");
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys("isActive");

-- Notification preferences indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences("userId");

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_user ON uploaded_documents("userId");
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_type ON uploaded_documents("documentType");
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_status ON uploaded_documents("processingStatus");
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_retention ON uploaded_documents("scheduledDeletion");

-- Document analysis indexes
CREATE INDEX IF NOT EXISTS idx_document_analysis_document ON document_analysis_results("documentId");
CREATE INDEX IF NOT EXISTS idx_document_analysis_user ON document_analysis_results("userId");
CREATE INDEX IF NOT EXISTS idx_document_analysis_status ON document_analysis_results("analysisStatus");
CREATE INDEX IF NOT EXISTS idx_document_analysis_type ON document_analysis_results("analysisType");

-- Document data points indexes
CREATE INDEX IF NOT EXISTS idx_document_data_points_analysis ON document_data_points("analysisId");
CREATE INDEX IF NOT EXISTS idx_document_data_points_document ON document_data_points("documentId");
CREATE INDEX IF NOT EXISTS idx_document_data_points_user ON document_data_points("userId");
CREATE INDEX IF NOT EXISTS idx_document_data_points_type ON document_data_points("dataType");
CREATE INDEX IF NOT EXISTS idx_document_data_points_verification ON document_data_points("verificationStatus");

-- Document cross-references indexes
CREATE INDEX IF NOT EXISTS idx_document_cross_refs_document ON document_cross_references("documentId");
CREATE INDEX IF NOT EXISTS idx_document_cross_refs_user ON document_cross_references("userId");
CREATE INDEX IF NOT EXISTS idx_document_cross_refs_entity ON document_cross_references("referenceEntityType", "referenceEntityId");
CREATE INDEX IF NOT EXISTS idx_document_cross_refs_active ON document_cross_references("isActive");

-- Sync records indexes
CREATE INDEX IF NOT EXISTS idx_sync_records_entity ON sync_records("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_sync_records_status ON sync_records(status);
CREATE INDEX IF NOT EXISTS idx_sync_records_external ON sync_records("externalSystem");
CREATE INDEX IF NOT EXISTS idx_sync_records_retry ON sync_records("nextRetryAt");

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events("userId");
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events("sessionId");
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events("eventType");

-- Update schema version
INSERT INTO schema_version (version) VALUES (2) ON CONFLICT (version) DO NOTHING;
