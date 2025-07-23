/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('users', function (table) {
      table.index(['email'], 'idx_users_email');
      table.index(['isActive'], 'idx_users_active');
    })
    .alterTable('companies', function (table) {
      table.index(['userId'], 'idx_companies_user');
      table.index(['status'], 'idx_companies_status');
      table.index(['ein'], 'idx_companies_ein');
    })
    .alterTable('documents', function (table) {
      table.index(['userId'], 'idx_documents_user');
      table.index(['companyId'], 'idx_documents_company');
      table.index(['status'], 'idx_documents_status');
      table.index(['documentType'], 'idx_documents_type');
    })
    .alterTable('audit_logs', function (table) {
      table.index(['userId'], 'idx_audit_logs_user');
      table.index(['timestamp'], 'idx_audit_logs_timestamp');
      table.index(['action'], 'idx_audit_logs_action');
      table.index(['resource'], 'idx_audit_logs_resource');
    })
    .alterTable('grant_matches', function (table) {
      table.index(['userId'], 'idx_grant_matches_user');
      table.index(['grantId'], 'idx_grant_matches_grant');
      table.index(['eligibilityStatus'], 'idx_grant_matches_status');
      table.index(['recommendationPriority'], 'idx_grant_matches_priority');
    })
    .alterTable('grant_opportunities', function (table) {
      table.index(['grantType'], 'idx_grant_opportunities_type');
      table.index(['isActive'], 'idx_grant_opportunities_active');
      table.index(['applicationDeadline'], 'idx_grant_opportunities_deadline');
    })
    .alterTable('user_sessions', function (table) {
      table.index(['userId'], 'idx_user_sessions_user');
      table.index(['sessionToken'], 'idx_user_sessions_token');
      table.index(['expiresAt'], 'idx_user_sessions_expires');
    })
    .alterTable('uploaded_documents', function (table) {
      table.index(['userId'], 'idx_uploaded_documents_user');
      table.index(['documentType'], 'idx_uploaded_documents_type');
      table.index(['isProcessed'], 'idx_uploaded_documents_processed');
    })
    .alterTable('wizard_progress', function (table) {
      table.index(['userId'], 'idx_wizard_progress_user');
      table.index(['currentPhase'], 'idx_wizard_progress_phase');
    })
    .alterTable('business_formation_workflows', function (table) {
      table.index(['userId'], 'idx_business_workflows_user');
      table.index(['status'], 'idx_business_workflows_status');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('business_formation_workflows', function (table) {
      table.dropIndex(['userId'], 'idx_business_workflows_user');
      table.dropIndex(['status'], 'idx_business_workflows_status');
    })
    .alterTable('wizard_progress', function (table) {
      table.dropIndex(['userId'], 'idx_wizard_progress_user');
      table.dropIndex(['currentPhase'], 'idx_wizard_progress_phase');
    })
    .alterTable('uploaded_documents', function (table) {
      table.dropIndex(['userId'], 'idx_uploaded_documents_user');
      table.dropIndex(['documentType'], 'idx_uploaded_documents_type');
      table.dropIndex(['isProcessed'], 'idx_uploaded_documents_processed');
    })
    .alterTable('user_sessions', function (table) {
      table.dropIndex(['userId'], 'idx_user_sessions_user');
      table.dropIndex(['sessionToken'], 'idx_user_sessions_token');
      table.dropIndex(['expiresAt'], 'idx_user_sessions_expires');
    })
    .alterTable('grant_opportunities', function (table) {
      table.dropIndex(['grantType'], 'idx_grant_opportunities_type');
      table.dropIndex(['isActive'], 'idx_grant_opportunities_active');
      table.dropIndex(['applicationDeadline'], 'idx_grant_opportunities_deadline');
    })
    .alterTable('grant_matches', function (table) {
      table.dropIndex(['userId'], 'idx_grant_matches_user');
      table.dropIndex(['grantId'], 'idx_grant_matches_grant');
      table.dropIndex(['eligibilityStatus'], 'idx_grant_matches_status');
      table.dropIndex(['recommendationPriority'], 'idx_grant_matches_priority');
    })
    .alterTable('audit_logs', function (table) {
      table.dropIndex(['userId'], 'idx_audit_logs_user');
      table.dropIndex(['timestamp'], 'idx_audit_logs_timestamp');
      table.dropIndex(['action'], 'idx_audit_logs_action');
      table.dropIndex(['resource'], 'idx_audit_logs_resource');
    })
    .alterTable('documents', function (table) {
      table.dropIndex(['userId'], 'idx_documents_user');
      table.dropIndex(['companyId'], 'idx_documents_company');
      table.dropIndex(['status'], 'idx_documents_status');
      table.dropIndex(['documentType'], 'idx_documents_type');
    })
    .alterTable('companies', function (table) {
      table.dropIndex(['userId'], 'idx_companies_user');
      table.dropIndex(['status'], 'idx_companies_status');
      table.dropIndex(['ein'], 'idx_companies_ein');
    })
    .alterTable('users', function (table) {
      table.dropIndex(['email'], 'idx_users_email');
      table.dropIndex(['isActive'], 'idx_users_active');
    });
};
