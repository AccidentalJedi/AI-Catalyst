/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('wizard_progress', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('currentPhase', 100).notNullable();
      table.string('currentStep', 100).notNullable();
      table.json('completedSteps').defaultTo('[]');
      table.decimal('overallProgress', 5, 2).defaultTo(0);
      table.integer('estimatedTimeRemaining').defaultTo(0);
      table.timestamp('lastUpdated').defaultTo(knex.fn.now());
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('business_formation_workflows', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('workflowType', 100).notNullable();
      table.string('currentStep', 100).notNullable();
      table.json('completedSteps').defaultTo('[]');
      table.string('status', 50).defaultTo('in_progress');
      table.json('formData');
      table.timestamp('completedAt');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('generated_documents', function (table) {
      table.uuid('id').primary();
      table.uuid('workflowId').notNullable();
      table.uuid('documentId').notNullable();
      table.string('generationType', 100).notNullable();
      table.json('generationData');
      table.timestamp('generatedAt').defaultTo(knex.fn.now());
      
      table.foreign('workflowId').references('id').inTable('business_formation_workflows');
      table.foreign('documentId').references('id').inTable('documents');
    })
    .createTable('compliance_checkpoints', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('name', 255).notNullable();
      table.text('description');
      table.boolean('isRequired').defaultTo(true);
      table.timestamp('deadline');
      table.boolean('isCompleted').defaultTo(false);
      table.timestamp('completedAt');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('user_sessions', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('sessionToken', 255).notNullable().unique();
      table.timestamp('expiresAt').notNullable();
      table.string('ipAddress', 45);
      table.string('userAgent', 500);
      table.boolean('isActive').defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('lastAccessedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('user_roles', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('role', 50).notNullable(); // 'admin', 'user', 'veteran'
      table.timestamp('assignedAt').defaultTo(knex.fn.now());
      table.boolean('isActive').defaultTo(true);
      
      table.foreign('userId').references('id').inTable('users');
    })
    .createTable('veteran_verification', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('verificationStatus', 50).defaultTo('pending');
      table.string('county', 100);
      table.integer('vaDisabilityRating');
      table.string('branchOfService', 50);
      table.string('dischargeType', 50);
      table.string('serviceEra', 50);
      table.json('verificationData');
      table.timestamp('verifiedAt');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('veteran_verification')
    .dropTableIfExists('user_roles')
    .dropTableIfExists('user_sessions')
    .dropTableIfExists('compliance_checkpoints')
    .dropTableIfExists('generated_documents')
    .dropTableIfExists('business_formation_workflows')
    .dropTableIfExists('wizard_progress');
};
