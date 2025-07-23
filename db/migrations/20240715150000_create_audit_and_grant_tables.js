/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('audit_logs', function (table) {
      table.uuid('id').primary();
      table.uuid('userId');
      table.string('sessionId', 255);
      table.string('action', 100).notNullable();
      table.string('resource', 100).notNullable();
      table.string('resourceId', 255);
      table.json('oldValues');
      table.json('newValues');
      table.string('ipAddress', 45);
      table.string('userAgent', 500);
      table.boolean('success').defaultTo(true);
      table.text('errorMessage');
      table.json('metadata');
      table.timestamp('timestamp').defaultTo(knex.fn.now());

      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('encryption_keys', function (table) {
      table.uuid('id').primary();
      table.string('keyName', 100).notNullable().unique();
      table.text('encryptedKey').notNullable();
      table.string('algorithm', 50).notNullable();
      table.boolean('isActive').defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('expiresAt');
    })
    .createTable('notification_preferences', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.boolean('emailNotifications').defaultTo(true);
      table.boolean('smsNotifications').defaultTo(false);
      table.boolean('complianceReminders').defaultTo(true);
      table.boolean('documentUpdates').defaultTo(true);
      table.boolean('grantOpportunities').defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());

      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('uploaded_documents', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('originalName', 255).notNullable();
      table.string('fileName', 255).notNullable();
      table.string('filePath', 500).notNullable();
      table.string('mimeType', 100).notNullable();
      table.integer('fileSize').notNullable();
      table.string('documentType', 100);
      table.string('uploadPurpose', 100);
      table.boolean('isProcessed').defaultTo(false);
      table.timestamp('uploadedAt').defaultTo(knex.fn.now());

      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('document_analysis_results', function (table) {
      table.uuid('id').primary();
      table.uuid('documentId').notNullable();
      table.string('analysisType', 100).notNullable();
      table.json('extractedData');
      table.decimal('confidenceScore', 5, 4);
      table.json('metadata');
      table.timestamp('analyzedAt').defaultTo(knex.fn.now());

      table.foreign('documentId').references('id').inTable('uploaded_documents');
    })
    .createTable('document_data_points', function (table) {
      table.uuid('id').primary();
      table.uuid('analysisId').notNullable();
      table.string('fieldName', 100).notNullable();
      table.text('fieldValue');
      table.decimal('confidence', 5, 4);
      table.string('dataType', 50);
      table.json('boundingBox');

      table.foreign('analysisId').references('id').inTable('document_analysis_results');
    })
    .createTable('document_cross_references', function (table) {
      table.uuid('id').primary();
      table.uuid('sourceDocumentId').notNullable();
      table.uuid('targetDocumentId').notNullable();
      table.string('referenceType', 100).notNullable();
      table.decimal('matchScore', 5, 4);
      table.json('matchingFields');
      table.timestamp('createdAt').defaultTo(knex.fn.now());

      table.foreign('sourceDocumentId').references('id').inTable('uploaded_documents');
      table.foreign('targetDocumentId').references('id').inTable('uploaded_documents');
    })
    .createTable('grant_opportunities', function (table) {
      table.uuid('id').primary();
      table.string('grantName', 255).notNullable();
      table.string('grantingOrganization', 255).notNullable();
      table.string('grantType', 100).notNullable();
      table.decimal('maxGrantAmount', 12, 2);
      table.integer('minDisabilityRating');
      table.integer('frictionScore').defaultTo(5);
      table.integer('documentationBurden').defaultTo(3);
      table.integer('processSteps').defaultTo(3);
      table.integer('thirdPartyDependency').defaultTo(2);
      table.integer('ambiguityGatekeeping').defaultTo(2);
      table.integer('submissionMode').defaultTo(2);
      table.json('eligibilityCriteria');
      table.json('requiredDocuments');
      table.json('actionableSteps');
      table.text('description');
      table.string('applicationUrl', 500);
      table.date('applicationDeadline');
      table.boolean('isActive').defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    })
    .createTable('grant_matches', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.uuid('grantId').notNullable();
      table.decimal('matchScore', 5, 4).notNullable();
      table.string('eligibilityStatus', 50).notNullable();
      table.text('matchReason');
      table.boolean('ruleBasedMatch').defaultTo(false);
      table.string('llmClassification', 100);
      table.decimal('llmConfidence', 5, 4);
      table.decimal('frictionAdjustedScore', 5, 4);
      table.integer('recommendationPriority').defaultTo(1);
      table.text('userFeedback');
      table.boolean('applicationStarted').defaultTo(false);
      table.boolean('applicationCompleted').defaultTo(false);
      table.boolean('grantAwarded').defaultTo(false);
      table.timestamp('lastChecked').defaultTo(knex.fn.now());
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());

      table.foreign('userId').references('id').inTable('users');
      table.foreign('grantId').references('id').inTable('grant_opportunities');
    })
    .createTable('sync_records', function (table) {
      table.uuid('id').primary();
      table.string('syncType', 100).notNullable();
      table.string('externalId', 255);
      table.uuid('internalId');
      table.json('syncData');
      table.timestamp('lastSyncAt').defaultTo(knex.fn.now());
      table.string('syncStatus', 50).defaultTo('pending');
    })
    .createTable('analytics_events', function (table) {
      table.uuid('id').primary();
      table.uuid('userId');
      table.string('eventType', 100).notNullable();
      table.string('eventCategory', 100);
      table.json('eventData');
      table.string('sessionId', 255);
      table.string('ipAddress', 45);
      table.string('userAgent', 500);
      table.timestamp('timestamp').defaultTo(knex.fn.now());

      table.foreign('userId').references('id').inTable('users');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('analytics_events')
    .dropTableIfExists('sync_records')
    .dropTableIfExists('grant_matches')
    .dropTableIfExists('grant_opportunities')
    .dropTableIfExists('document_cross_references')
    .dropTableIfExists('document_data_points')
    .dropTableIfExists('document_analysis_results')
    .dropTableIfExists('uploaded_documents')
    .dropTableIfExists('notification_preferences')
    .dropTableIfExists('encryption_keys')
    .dropTableIfExists('audit_logs');
};
